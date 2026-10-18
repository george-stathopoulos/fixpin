// FixSpot service worker: works offline for the app shell, and receives screenshots
// shared to FixSpot from the phone's share sheet.
const CACHE = 'fixspot-v1';
const SHELL = [ '/', '/view', '/app.css', '/app.js', '/view.js', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png' ];

self.addEventListener( 'install', ( e ) => {
	e.waitUntil( caches.open( CACHE ).then( ( c ) => c.addAll( SHELL ) ).then( () => self.skipWaiting() ) );
} );

self.addEventListener( 'activate', ( e ) => {
	e.waitUntil(
		caches.keys().then( ( keys ) => Promise.all( keys.filter( ( k ) => k !== CACHE ).map( ( k ) => caches.delete( k ) ) ) ).then( () => self.clients.claim() )
	);
} );

self.addEventListener( 'fetch', ( e ) => {
	const req = e.request;
	const url = new URL( req.url );
	if ( url.origin !== location.origin ) {
		return;
	}
	if ( req.method === 'POST' && url.pathname === '/share' ) {
		e.respondWith( ( async () => {
			const form = await req.formData();
			const cache = await caches.open( 'fixspot-share' );
			const file = form.get( 'screenshot' );
			if ( file && file.size ) {
				await cache.put( '/shared-screenshot', new Response( file, { headers: { 'content-type': file.type } } ) );
			}
			const meta = { url: form.get( 'url' ) || '', title: form.get( 'title' ) || '', text: form.get( 'text' ) || '' };
			await cache.put( '/shared-meta', new Response( JSON.stringify( meta ) ) );
			return Response.redirect( '/?shared=1', 303 );
		} )() );
		return;
	}
	if ( req.method !== 'GET' || url.pathname.startsWith( '/api/' ) ) {
		return; // reports always come fresh from the network
	}
	if ( req.mode === 'navigate' && /^\/r\/[\w-]+$/.test( url.pathname ) ) {
		e.respondWith( fetch( req ).catch( () => caches.match( '/view' ) ) );
		return;
	}
	e.respondWith( caches.match( req ).then( ( hit ) => {
		const net = fetch( req ).then( ( res ) => {
			if ( res.ok ) {
				const copy = res.clone();
				caches.open( CACHE ).then( ( c ) => c.put( req, copy ) );
			}
			return res;
		} ).catch( () => hit );
		return hit || net;
	} ) );
} );
