// Fixpass app: add a screenshot, mark the spots, create a private expiring link.
const $ = ( id ) => document.getElementById( id );
const MAX_SPOTS = 5;
let dataUrl = '';
let spots = []; // fractions of the screenshot: { x, y, w, h }
let extras = { errors: [], viewport: null, ua: '', title: '' };

const store = {
	get: ( k, d ) => { try { return JSON.parse( localStorage.getItem( k ) ) ?? d; } catch { return d; } },
	set: ( k, v ) => { try { localStorage.setItem( k, JSON.stringify( v ) ); } catch { /* private mode */ } },
};

const show = ( step ) => [ 'pick', 'mark', 'done' ].forEach( ( s ) => ( $( 'step-' + s ).hidden = s !== step ) );

/** Shrink big screenshots so the report stays small (max 1600px wide, JPEG). */
function shrink( file ) {
	return new Promise( ( resolve, reject ) => {
		const img = new Image();
		img.onload = () => {
			const k = Math.min( 1, 1600 / img.naturalWidth );
			const c = document.createElement( 'canvas' );
			c.width = Math.round( img.naturalWidth * k );
			c.height = Math.round( img.naturalHeight * k );
			c.getContext( '2d' ).drawImage( img, 0, 0, c.width, c.height );
			URL.revokeObjectURL( img.src );
			resolve( { url: c.toDataURL( 'image/jpeg', 0.82 ), w: img.naturalWidth, h: img.naturalHeight } );
		};
		img.onerror = () => reject( new Error( 'That file is not an image.' ) );
		img.src = URL.createObjectURL( file );
	} );
}

async function useFile( file, meta = {} ) {
	if ( ! file || ! file.type.startsWith( 'image/' ) ) {
		return;
	}
	const s = await shrink( file );
	dataUrl = s.url;
	spots = [];
	extras = { errors: [], viewport: { w: s.w, h: s.h, dpr: devicePixelRatio || 1 }, ua: navigator.userAgent, title: meta.title || '' };
	$( 'shot' ).src = dataUrl;
	$( 'url' ).value = meta.url || '';
	$( 'note' ).value = meta.text || '';
	drawBoxes();
	$( 'err' ).hidden = true;
	show( 'mark' );
}

function drawBoxes() {
	const host = $( 'boxes' );
	host.replaceChildren( ...spots.map( ( s, i ) => {
		const b = document.createElement( 'div' );
		b.className = 'box';
		b.style.cssText = `left:${ s.x * 100 }%;top:${ s.y * 100 }%;width:${ s.w * 100 }%;height:${ s.h * 100 }%`;
		const n = document.createElement( 'b' );
		n.textContent = i + 1;
		b.append( n );
		b.dataset.i = i;
		return b;
	} ) );
}

// Click or drag on the screenshot to mark a spot.
( () => {
	const stage = $( 'stage' );
	let start = null;
	let live = null;
	const pt = ( e ) => {
		const r = stage.getBoundingClientRect();
		return { x: Math.min( 1, Math.max( 0, ( e.clientX - r.left ) / r.width ) ), y: Math.min( 1, Math.max( 0, ( e.clientY - r.top ) / r.height ) ) };
	};
	stage.addEventListener( 'pointerdown', ( e ) => {
		const hit = e.target.closest( '.box' );
		if ( hit && ! live ) {
			spots.splice( Number( hit.dataset.i ), 1 );
			drawBoxes();
			return;
		}
		stage.setPointerCapture( e.pointerId );
		start = pt( e );
		live = null;
	} );
	stage.addEventListener( 'pointermove', ( e ) => {
		if ( ! start ) {
			return;
		}
		const p = pt( e );
		live = { x: Math.min( start.x, p.x ), y: Math.min( start.y, p.y ), w: Math.abs( p.x - start.x ), h: Math.abs( p.y - start.y ) };
		drawBoxes();
		const b = document.createElement( 'div' );
		b.className = 'box';
		b.style.cssText = `left:${ live.x * 100 }%;top:${ live.y * 100 }%;width:${ live.w * 100 }%;height:${ live.h * 100 }%`;
		$( 'boxes' ).append( b );
	} );
	stage.addEventListener( 'pointerup', () => {
		if ( ! start ) {
			return;
		}
		let s = live;
		if ( ! s || ( s.w < 0.01 && s.h < 0.01 ) ) {
			// A plain click marks a default-sized spot around the point.
			s = { x: Math.max( 0, Math.min( 0.88, start.x - 0.06 ) ), y: Math.max( 0, Math.min( 0.9, start.y - 0.05 ) ), w: 0.12, h: 0.1 };
		}
		if ( spots.length < MAX_SPOTS ) {
			spots.push( s );
		}
		start = live = null;
		drawBoxes();
	} );
} )();

function remember( entry ) {
	const list = [ entry, ...store.get( 'fixpass.recent', [] ) ].slice( 0, 20 );
	store.set( 'fixpass.recent', list );
}

function renderRecent() {
	const now = Date.now();
	const list = store.get( 'fixpass.recent', [] ).filter( ( r ) => r.expiresAt > now );
	store.set( 'fixpass.recent', list );
	$( 'recent-h' ).hidden = ! list.length;
	$( 'recent' ).replaceChildren( ...list.map( ( r ) => {
		const li = document.createElement( 'li' );
		const a = document.createElement( 'a' );
		a.href = '/r/' + r.id;
		a.textContent = r.label || r.id.slice( 0, 8 );
		const d = document.createElement( 'span' );
		d.className = 'muted';
		d.textContent = 'expires ' + new Date( r.expiresAt ).toLocaleDateString();
		li.append( a, d );
		return li;
	} ) );
}

async function create() {
	const err = $( 'err' );
	err.hidden = true;
	if ( ! spots.length && ! $( 'note' ).value.trim() ) {
		err.textContent = 'Point at the problem or write a note first.';
		err.hidden = false;
		return;
	}
	$( 'create' ).disabled = true;
	try {
		const res = await fetch( '/api/reports', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify( {
				url: $( 'url' ).value.trim(), title: extras.title, note: $( 'note' ).value.trim(), ua: extras.ua,
				viewport: extras.viewport, errors: extras.errors, screenshot: dataUrl, days: Number( $( 'days' ).value ),
				passcode: $( 'pass' ).value.trim() || undefined,
				spots: spots.map( ( s, i ) => ( { ...s, note: '', selector: '', n: i + 1 } ) ),
			} ),
		} );
		const out = await res.json();
		if ( ! res.ok ) {
			throw new Error( out.error || 'Could not create the link.' );
		}
		const link = location.origin + '/r/' + out.id;
		remember( { id: out.id, owner: out.ownerToken, expiresAt: out.expiresAt, label: $( 'note' ).value.trim().slice( 0, 50 ) || 'Report' } );
		$( 'link' ).value = link;
		$( 'open' ).href = link;
		$( 'exp' ).textContent = 'Expires ' + new Date( out.expiresAt ).toLocaleString() + ( out.protected ? '. Share the passcode separately.' : '.' );
		show( 'done' );
		renderRecent();
	} catch ( e ) {
		err.textContent = e.message;
		err.hidden = false;
	} finally {
		$( 'create' ).disabled = false;
	}
}

// Wiring
const drop = $( 'drop' );
drop.addEventListener( 'click', () => $( 'file' ).click() );
drop.addEventListener( 'keydown', ( e ) => ( e.key === 'Enter' || e.key === ' ' ) && ( e.preventDefault(), $( 'file' ).click() ) );
$( 'file' ).addEventListener( 'change', ( e ) => useFile( e.target.files[ 0 ] ) );
[ 'dragover', 'dragenter' ].forEach( ( t ) => drop.addEventListener( t, ( e ) => ( e.preventDefault(), drop.classList.add( 'over' ) ) ) );
[ 'dragleave', 'drop' ].forEach( ( t ) => drop.addEventListener( t, () => drop.classList.remove( 'over' ) ) );
drop.addEventListener( 'drop', ( e ) => { e.preventDefault(); useFile( e.dataTransfer.files[ 0 ] ); } );
addEventListener( 'paste', ( e ) => {
	const f = [ ...( e.clipboardData?.files || [] ) ].find( ( x ) => x.type.startsWith( 'image/' ) );
	if ( f ) {
		useFile( f );
	}
} );
$( 'create' ).addEventListener( 'click', create );
$( 'back' ).addEventListener( 'click', () => show( 'pick' ) );
$( 'again' ).addEventListener( 'click', () => show( 'pick' ) );
$( 'copy' ).addEventListener( 'click', async () => {
	await navigator.clipboard.writeText( $( 'link' ).value ).catch( () => $( 'link' ).select() );
	$( 'copy' ).textContent = 'Copied';
	setTimeout( () => ( $( 'copy' ).textContent = 'Copy link' ), 1500 );
} );
if ( navigator.share ) {
	$( 'share' ).hidden = false;
	$( 'share' ).addEventListener( 'click', () => navigator.share( { title: 'Fixpass report', url: $( 'link' ).value } ).catch( () => {} ) );
}
$( 'help' ).addEventListener( 'click', () => $( 'tour' ).showModal() );

if ( 'serviceWorker' in navigator ) {
	navigator.serviceWorker.register( '/sw.js' ).catch( () => {} );
}

// First visit: show the short tour once.
if ( ! store.get( 'fixpass.toured', false ) ) {
	store.set( 'fixpass.toured', true );
	$( 'tour' ).showModal();
}

// A screenshot shared from the phone's share sheet.
if ( new URLSearchParams( location.search ).has( 'shared' ) ) {
	( async () => {
		const cache = await caches.open( 'fixpass-share' );
		const img = await cache.match( '/shared-screenshot' );
		const meta = await ( await cache.match( '/shared-meta' ) )?.json().catch( () => ( {} ) );
		if ( img ) {
			await useFile( new File( [ await img.blob() ], 'shared', { type: img.headers.get( 'content-type' ) || 'image/png' } ), meta || {} );
			await cache.delete( '/shared-screenshot' );
		}
		history.replaceState( null, '', '/' );
	} )();
}

renderRecent();
