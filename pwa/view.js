// Fixpass report viewer: shows the screenshot with the marked spots, the details and the errors.
const $ = ( id ) => document.getElementById( id );
const id = location.pathname.split( '/' ).pop();
let text = '';

const dd = ( k, v ) => {
	if ( ! v ) {
		return;
	}
	const t = document.createElement( 'dt' );
	t.textContent = k;
	const d = document.createElement( 'dd' );
	if ( /^https?:\/\//.test( v ) ) {
		const a = document.createElement( 'a' );
		a.href = v; a.textContent = v; a.rel = 'noopener noreferrer'; a.target = '_blank';
		d.append( a );
	} else {
		d.textContent = v;
	}
	$( 'details' ).append( t, d );
};

function gone( title, msg ) {
	$( 'lock' ).hidden = true;
	$( 'report' ).hidden = true;
	$( 'gone' ).hidden = false;
	$( 'gonetitle' ).textContent = title;
	$( 'gonemsg' ).textContent = msg;
}

async function load( pass ) {
	const res = await fetch( '/api/reports/' + id, { headers: pass ? { 'x-passcode': pass } : {} } ).catch( () => null );
	if ( ! res ) {
		return gone( 'You are offline', 'Reports are not stored on this device. Try again when you are back online.' );
	}
	const out = await res.json();
	if ( res.status === 401 || res.status === 403 ) {
		$( 'lock' ).hidden = false;
		if ( pass ) {
			$( 'lockerr' ).textContent = out.error;
			$( 'lockerr' ).hidden = false;
		}
		return;
	}
	if ( ! res.ok ) {
		return gone( 'Report not available', out.error );
	}
	render( out );
}

function render( { report: r, expiresAt, createdAt } ) {
	$( 'lock' ).hidden = true;
	$( 'report' ).hidden = false;
	document.title = 'Fixpass report' + ( r.title ? ': ' + r.title : '' );
	$( 'title' ).textContent = r.title || 'Report';
	$( 'note' ).textContent = r.note;
	if ( r.screenshot ) {
		$( 'shot' ).src = r.screenshot;
	} else {
		$( 'stage' ).hidden = true;
	}
	$( 'boxes' ).replaceChildren( ...r.spots.map( ( s, i ) => {
		const b = document.createElement( 'div' );
		b.className = 'box';
		b.style.cssText = `left:${ s.x * 100 }%;top:${ s.y * 100 }%;width:${ s.w * 100 }%;height:${ s.h * 100 }%`;
		const n = document.createElement( 'b' );
		n.textContent = i + 1;
		b.append( n );
		return b;
	} ) );
	dd( 'Page', r.url );
	dd( 'Screen', r.viewport.w ? `${ r.viewport.w } × ${ r.viewport.h }` + ( r.viewport.dpr > 1 ? ` at ${ r.viewport.dpr }x` : '' ) : '' );
	dd( 'Browser', r.ua );
	dd( 'Sent', new Date( createdAt ).toLocaleString() );
	r.spots.forEach( ( s, i ) => dd( `Spot ${ i + 1 }`, [ s.selector, s.note ].filter( Boolean ).join( ': ' ) ) );
	if ( r.errors.length ) {
		$( 'errcard' ).hidden = false;
		$( 'errors' ).textContent = r.errors.map( ( e ) => `[${ e.type }] ${ e.msg }` ).join( '\n' );
	}
	$( 'exp' ).textContent = 'This report is deleted on ' + new Date( expiresAt ).toLocaleString() + '.';
	text = [
		'Fixpass report: ' + location.href, r.note && 'Problem: ' + r.note, r.url && 'Page: ' + r.url,
		r.viewport.w && `Screen: ${ r.viewport.w }x${ r.viewport.h }`, r.ua && 'Browser: ' + r.ua,
		...r.spots.map( ( s, i ) => `Spot ${ i + 1 }: ` + ( s.selector || `${ Math.round( s.x * 100 ) }%, ${ Math.round( s.y * 100 ) }%` ) ),
		r.errors.length && 'Errors:\n' + r.errors.map( ( e ) => `  [${ e.type }] ${ e.msg }` ).join( '\n' ),
	].filter( Boolean ).join( '\n' );
	let owner = '';
	try { owner = ( JSON.parse( localStorage.getItem( 'fixpass.recent' ) ) || [] ).find( ( x ) => x.id === id )?.owner || ''; } catch { /* none */ }
	if ( owner ) {
		$( 'del' ).hidden = false;
		$( 'del' ).onclick = async () => {
			await fetch( '/api/reports/' + id, { method: 'DELETE', headers: { 'x-owner-token': owner } } );
			gone( 'Report deleted', 'It is gone for everyone who had the link.' );
		};
	}
}

$( 'lockform' ).addEventListener( 'submit', ( e ) => { e.preventDefault(); load( $( 'pass' ).value ); } );
$( 'copy' ).addEventListener( 'click', async () => {
	await navigator.clipboard.writeText( text ).catch( () => {} );
	$( 'copy' ).textContent = 'Copied';
	setTimeout( () => ( $( 'copy' ).textContent = 'Copy details' ), 1500 );
} );
if ( 'serviceWorker' in navigator ) {
	navigator.serviceWorker.register( '/sw.js' ).catch( () => {} );
}
load();
