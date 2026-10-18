/**
 * Fixpass Worker: stores Spotlight reports for a limited time and serves the app.
 *
 * - POST   /api/reports      create a report -> { id, ownerToken, expiresAt }
 * - GET    /api/reports/:id  read a report (X-Passcode header if it has one)
 * - DELETE /api/reports/:id  delete early (X-Owner-Token header)
 *
 * No accounts. The link is a random 192-bit id; only a hash of the owner token and
 * passcode is stored; everything expires by itself (KV TTL).
 */

const MAX_BODY = 2 * 1024 * 1024; // 2 MB, screenshot included
const DAYS = [ 1, 7, 30 ];
const CORS = {
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
	'access-control-allow-headers': 'content-type,x-passcode,x-owner-token',
	'access-control-max-age': '86400',
};

const json = ( data, status = 200 ) =>
	new Response( JSON.stringify( data ), {
		status,
		headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS },
	} );

const b64url = ( bytes ) =>
	btoa( String.fromCharCode( ...bytes ) ).replace( /\+/g, '-' ).replace( /\//g, '_' ).replace( /=+$/, '' );

const random = ( n ) => b64url( crypto.getRandomValues( new Uint8Array( n ) ) );

async function sha256( text ) {
	const d = await crypto.subtle.digest( 'SHA-256', new TextEncoder().encode( text ) );
	return b64url( new Uint8Array( d ) );
}

function eq( a, b ) {
	if ( a.length !== b.length ) {
		return false;
	}
	let r = 0;
	for ( let i = 0; i < a.length; i++ ) {
		r |= a.charCodeAt( i ) ^ b.charCodeAt( i );
	}
	return r === 0;
}

const str = ( v, max ) => ( typeof v === 'string' ? v.slice( 0, max ) : '' );
const num = ( v ) => ( Number.isFinite( v ) ? v : 0 );
const frac = ( v ) => Math.min( 1, Math.max( 0, num( v ) ) );

/** Keep only the fields we know, trimmed to sane sizes. */
export function clean( b ) {
	const shot = str( b.screenshot, MAX_BODY );
	return {
		v: 1,
		url: str( b.url, 2000 ),
		title: str( b.title, 300 ),
		note: str( b.note, 4000 ),
		ua: str( b.ua, 400 ),
		viewport: { w: num( b.viewport?.w ), h: num( b.viewport?.h ), dpr: num( b.viewport?.dpr ) || 1 },
		spots: ( Array.isArray( b.spots ) ? b.spots : [] ).slice( 0, 10 ).map( ( s ) => ( {
			x: frac( s.x ), y: frac( s.y ), w: frac( s.w ), h: frac( s.h ),
			note: str( s.note, 1000 ), selector: str( s.selector, 500 ),
		} ) ),
		errors: ( Array.isArray( b.errors ) ? b.errors : [] ).slice( 0, 30 ).map( ( e ) => ( {
			type: str( e.type, 20 ), msg: str( e.msg, 600 ),
		} ) ),
		screenshot: /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test( shot ) ? shot : '',
	};
}

async function create( request, env ) {
	const raw = await request.text();
	if ( raw.length > MAX_BODY ) {
		return json( { error: 'Report too large (2 MB max).' }, 413 );
	}
	let body;
	try {
		body = JSON.parse( raw );
	} catch {
		return json( { error: 'Invalid JSON.' }, 400 );
	}
	const report = clean( body );
	if ( ! report.url && ! report.note && ! report.screenshot ) {
		return json( { error: 'Empty report.' }, 400 );
	}
	const days = DAYS.includes( body.days ) ? body.days : 7;
	const id = random( 24 );
	const ownerToken = random( 24 );
	const now = Date.now();
	const record = {
		report,
		owner: await sha256( ownerToken ),
		pass: body.passcode ? await sha256( id + String( body.passcode ).slice( 0, 200 ) ) : '',
		createdAt: now,
		expiresAt: now + days * 86400000,
	};
	await env.REPORTS.put( id, JSON.stringify( record ), { expirationTtl: days * 86400 } );
	return json( { id, ownerToken, expiresAt: record.expiresAt, protected: !! record.pass }, 201 );
}

async function load( id, env ) {
	const text = await env.REPORTS.get( id );
	return text ? JSON.parse( text ) : null;
}

async function read( id, request, env ) {
	const rec = await load( id, env );
	if ( ! rec || rec.expiresAt < Date.now() ) {
		return json( { error: 'This report has expired or does not exist.' }, 404 );
	}
	if ( rec.pass ) {
		const given = request.headers.get( 'x-passcode' );
		if ( ! given ) {
			return json( { error: 'Passcode needed.', needsPasscode: true }, 401 );
		}
		if ( ! eq( await sha256( id + given ), rec.pass ) ) {
			return json( { error: 'Wrong passcode.', needsPasscode: true }, 403 );
		}
	}
	return json( { report: rec.report, createdAt: rec.createdAt, expiresAt: rec.expiresAt } );
}

async function remove( id, request, env ) {
	const rec = await load( id, env );
	if ( ! rec ) {
		return json( { ok: true } );
	}
	const token = request.headers.get( 'x-owner-token' ) || '';
	if ( ! eq( await sha256( token ), rec.owner ) ) {
		return json( { error: 'Not allowed.' }, 403 );
	}
	await env.REPORTS.delete( id );
	return json( { ok: true } );
}

export async function handle( request, env ) {
	const url = new URL( request.url );
	if ( request.method === 'OPTIONS' ) {
		return new Response( null, { status: 204, headers: CORS } );
	}
	if ( url.pathname === '/api/reports' && request.method === 'POST' ) {
		return create( request, env );
	}
	const m = url.pathname.match( /^\/api\/reports\/([\w-]{20,64})$/ );
	if ( m && request.method === 'GET' ) {
		return read( m[ 1 ], request, env );
	}
	if ( m && request.method === 'DELETE' ) {
		return remove( m[ 1 ], request, env );
	}
	if ( url.pathname.startsWith( '/api/' ) ) {
		return json( { error: 'Not found.' }, 404 );
	}
	return null; // not ours: static assets
}

export default {
	async fetch( request, env ) {
		const res = await handle( request, env );
		if ( res ) {
			return res;
		}
		const url = new URL( request.url );
		// /r/<id> is the report viewer (one page, reads the id from the address).
		if ( /^\/r\/[\w-]+$/.test( url.pathname ) ) {
			return env.ASSETS.fetch( new Request( new URL( '/view', url ), request ) );
		}
		return env.ASSETS.fetch( request );
	},
};
