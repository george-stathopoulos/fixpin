import test from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../worker/index.js';

const kv = () => {
	const m = new Map();
	return { put: async ( k, v ) => m.set( k, v ), get: async ( k ) => m.get( k ) ?? null, delete: async ( k ) => m.delete( k ) };
};
const call = ( env, method, path, body, headers = {} ) =>
	handle( new Request( 'https://x.test' + path, { method, headers, body: body && JSON.stringify( body ) } ), env );

const sample = {
	url: 'https://shop.test/cart', note: 'Button does nothing', days: 7,
	viewport: { w: 1200, h: 800, dpr: 2 },
	spots: [ { x: 0.2, y: 0.3, w: 0.1, h: 0.05, note: 'here', selector: 'button.buy' } ],
	errors: [ { type: 'error', msg: 'TypeError: x is undefined' } ],
	screenshot: 'data:image/jpeg;base64,AAAA', evil: '<script>',
};

test( 'create, read, delete', async () => {
	const env = { REPORTS: kv() };
	const c = await call( env, 'POST', '/api/reports', sample );
	assert.equal( c.status, 201 );
	const { id, ownerToken } = await c.json();
	const r = await ( await call( env, 'GET', '/api/reports/' + id ) ).json();
	assert.equal( r.report.note, 'Button does nothing' );
	assert.equal( r.report.evil, undefined );
	assert.equal( ( await call( env, 'DELETE', '/api/reports/' + id, null, { 'x-owner-token': 'nope' } ) ).status, 403 );
	assert.equal( ( await call( env, 'DELETE', '/api/reports/' + id, null, { 'x-owner-token': ownerToken } ) ).status, 200 );
	assert.equal( ( await call( env, 'GET', '/api/reports/' + id ) ).status, 404 );
} );

test( 'passcode', async () => {
	const env = { REPORTS: kv() };
	const { id } = await ( await call( env, 'POST', '/api/reports', { ...sample, passcode: 'abc' } ) ).json();
	assert.equal( ( await call( env, 'GET', '/api/reports/' + id ) ).status, 401 );
	assert.equal( ( await call( env, 'GET', '/api/reports/' + id, null, { 'x-passcode': 'bad' } ) ).status, 403 );
	assert.equal( ( await call( env, 'GET', '/api/reports/' + id, null, { 'x-passcode': 'abc' } ) ).status, 200 );
} );

test( 'rejects empty, bad json, bad screenshot is dropped', async () => {
	const env = { REPORTS: kv() };
	assert.equal( ( await call( env, 'POST', '/api/reports', {} ) ).status, 400 );
	const { id } = await ( await call( env, 'POST', '/api/reports', { ...sample, screenshot: 'javascript:alert(1)' } ) ).json();
	const r = await ( await call( env, 'GET', '/api/reports/' + id ) ).json();
	assert.equal( r.report.screenshot, '' );
} );
