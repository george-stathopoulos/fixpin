/**
 * FixSpot home: vertical scrolling moves one long page sideways, your pointer is a flashlight,
 * and things that are broken in the dark get boxed and numbered when the light finds them.
 * Small screens and no-JavaScript visitors get the same panels stacked, with the lights on.
 */
( function () {
	'use strict';

	var body = document.body;
	var hs = document.querySelector( '[data-hs]' );
	if ( ! hs ) {
		return;
	}
	var pin = hs.querySelector( '[data-pin]' );
	var track = hs.querySelector( '[data-track]' );
	var panels = [].slice.call( track.querySelectorAll( '[data-panel]' ) );
	var dark = document.querySelector( '[data-dark]' );
	var dots = hs.querySelector( '[data-dots]' );
	var hint = hs.querySelector( '[data-scrollhint]' );
	var bugs = [].slice.call( hs.querySelectorAll( '.bug' ) );
	var still = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
	var wide = window.matchMedia( '(min-width: 900px) and (min-height: 560px)' );
	var fine = window.matchMedia( '(hover: hover) and (pointer: fine)' );
	var foot = document.querySelector( '.site-foot' );
	var footHome = foot ? foot.parentNode : null;
	var footNext = foot ? foot.nextSibling : null;
	var SPEED = 0.8; // vertical pixels per sideways pixel: lower is faster
	var active = false;
	var maxX = 0;
	var headH = 53;
	var x = 0;
	var target = 0;
	var raf = 0;
	var light = { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2 };
	var found = 0;

	/* ----- bugs: number them and add their note ----- */
	bugs.forEach( function ( b, i ) {
		var n = document.createElement( 'i' );
		n.className = 'bug__n';
		n.textContent = i + 1;
		var note = document.createElement( 'em' );
		note.className = 'bug__note';
		note.textContent = b.getAttribute( 'data-note' ) || '';
		b.appendChild( n );
		b.appendChild( note );
		b.setAttribute( 'aria-hidden', 'true' );
	} );
	hs.querySelector( '[data-bugs-total]' ).textContent = bugs.length;
	function spot( b ) {
		if ( b.classList.contains( 'found' ) ) {
			return;
		}
		b.classList.add( 'found' );
		found++;
		var bar = hs.querySelector( '[data-bugs]' );
		bar.hidden = false;
		hs.querySelector( '[data-bugs-n]' ).textContent = found;
		if ( found === bugs.length ) {
			bar.innerHTML = '<span aria-hidden="true">🔦</span> All ' + found + ' bugs spotted. Nice eyes.';
		}
	}

	/* ----- dots ----- */
	panels.forEach( function ( p, i ) {
		var a = document.createElement( 'a' );
		a.href = '#' + ( p.id || 'p' + i );
		a.title = p.getAttribute( 'data-title' ) || '';
		a.setAttribute( 'aria-label', a.title );
		a.addEventListener( 'click', function ( e ) {
			e.preventDefault();
			goTo( i );
		} );
		dots.appendChild( a );
	} );

	/* ----- layout ----- */
	function measure() {
		headH = ( document.querySelector( '.site-head' ) || { offsetHeight: 53 } ).offsetHeight;
		body.style.setProperty( '--headh', headH + 'px' );
		maxX = Math.max( 0, track.scrollWidth - innerWidth );
		hs.style.height = Math.round( maxX * SPEED + innerHeight - headH ) + 'px';
	}
	function base() {
		return hs.getBoundingClientRect().top + window.scrollY - headH;
	}
	function scrollForX( px ) {
		return base() + px * SPEED;
	}
	function goTo( i ) {
		var px = Math.min( maxX, panels[ i ].offsetLeft );
		window.scrollTo( { top: scrollForX( px ), behavior: still ? 'auto' : 'smooth' } );
	}
	function currentTarget() {
		return Math.max( 0, Math.min( maxX, ( window.scrollY - base() ) / SPEED ) );
	}

	/* ----- frame loop ----- */
	function frame() {
		raf = 0;
		var busy = false;
		if ( active ) {
			target = currentTarget();
			var d = target - x;
			x = still || Math.abs( d ) < 0.4 ? target : x + d * 0.14;
			busy = Math.abs( d ) >= 0.4;
			track.style.transform = 'translate3d(' + -x.toFixed( 1 ) + 'px,0,0)';

			var cur = 0;
			panels.forEach( function ( p, i ) {
				var left = p.offsetLeft - x;
				var on = left < innerWidth * 0.75 && left + p.offsetWidth > innerWidth * 0.25;
				p.classList.toggle( 'is-on', on );
				if ( left < innerWidth * 0.5 && left + p.offsetWidth > innerWidth * 0.5 ) {
					cur = i;
				}
				if ( ! still ) {
					var mid = left + p.offsetWidth / 2 - innerWidth / 2;
					[].forEach.call( p.querySelectorAll( '[data-px]' ), function ( el ) {
						el.style.translate = ( mid * parseFloat( el.getAttribute( 'data-px' ) ) ).toFixed( 1 ) + 'px 0';
					} );
				}
			} );
			[].forEach.call( dots.children, function ( a, i ) {
				a.setAttribute( 'aria-current', i === cur ? 'true' : 'false' );
			} );
			hint.classList.toggle( 'is-gone', x > 40 );

			if ( body.classList.contains( 'has-light' ) ) {
				light.x += ( light.tx - light.x ) * 0.2;
				light.y += ( light.ty - light.y ) * 0.2;
				busy = busy || Math.abs( light.tx - light.x ) > 0.5 || Math.abs( light.ty - light.y ) > 0.5;
				dark.style.setProperty( '--mx', light.x.toFixed( 1 ) + 'px' );
				dark.style.setProperty( '--my', light.y.toFixed( 1 ) + 'px' );
			}
			findBugs();
		}
		if ( busy ) {
			request();
		}
	}
	function request() {
		if ( ! raf ) {
			raf = requestAnimationFrame( frame );
		}
	}

	/* ----- finding bugs: the beam, or (no pointer) the middle of the screen ----- */
	function findBugs() {
		var cx = light.x;
		var cy = light.y;
		var r = 130;
		if ( ! body.classList.contains( 'has-light' ) ) {
			cx = innerWidth / 2;
			cy = innerHeight / 2;
			r = Math.min( innerWidth, innerHeight ) * 0.42;
		}
		bugs.forEach( function ( b ) {
			if ( b.classList.contains( 'found' ) ) {
				return;
			}
			var q = b.getBoundingClientRect();
			var dx = Math.max( q.left - cx, 0, cx - q.right );
			var dy = Math.max( q.top - cy, 0, cy - q.bottom );
			if ( dx * dx + dy * dy < r * r ) {
				spot( b );
			}
		} );
	}

	/* ----- mode switching ----- */
	function enable() {
		active = true;
		body.classList.add( 'is-hs' );
		body.classList.toggle( 'has-light', fine.matches );
		if ( foot ) {
			panels[ panels.length - 1 ].appendChild( foot );
		}
		measure();
		request();
	}
	function disable() {
		active = false;
		body.classList.remove( 'is-hs', 'has-light' );
		track.style.transform = '';
		hs.style.height = '';
		[].forEach.call( hs.querySelectorAll( '[data-px]' ), function ( el ) {
			el.style.translate = '';
		} );
		if ( foot && footHome ) {
			footHome.insertBefore( foot, footNext );
		}
		bugs.forEach( findBugsStacked );
	}
	function findBugsStacked() {} // stacked mode shows every bug already boxed by CSS
	function apply() {
		if ( wide.matches ) {
			enable();
		} else {
			disable();
		}
	}

	window.addEventListener( 'scroll', request, { passive: true } );
	window.addEventListener( 'resize', function () {
		if ( active ) {
			measure();
		}
		apply();
		request();
	} );
	window.addEventListener( 'pointermove', function ( e ) {
		if ( e.pointerType === 'touch' ) {
			return;
		}
		light.tx = e.clientX;
		light.ty = e.clientY;
		request();
	} );
	document.addEventListener( 'pointerleave', function () {
		light.tx = innerWidth / 2;
		light.ty = innerHeight / 2;
	} );
	// The pin never scrolls by itself; tabbing to an off-screen link scrolls the page instead.
	pin.addEventListener( 'scroll', function () {
		pin.scrollLeft = 0;
	} );
	hs.addEventListener( 'focusin', function ( e ) {
		if ( ! active ) {
			return;
		}
		var p = e.target.closest && e.target.closest( '[data-panel]' );
		var i = panels.indexOf( p );
		if ( i > -1 ) {
			var left = p.offsetLeft - x;
			if ( left < -20 || left > innerWidth * 0.5 ) {
				goTo( i );
			}
		}
	} );
	// In-page links (#how, #wordpress...) go to the panel, in both modes.
	document.addEventListener( 'click', function ( e ) {
		var a = e.target.closest && e.target.closest( 'a[href]' );
		if ( ! a || ! active ) {
			return;
		}
		var m = /(?:^|\/)(?:index\.html)?#([\w-]+)$/.exec( a.getAttribute( 'href' ) );
		if ( ! m ) {
			return;
		}
		var i = panels.findIndex( function ( p ) {
			return p.id === m[ 1 ];
		} );
		if ( i > -1 ) {
			e.preventDefault();
			goTo( i );
		}
	} );
	// Lights switch (the theme button): lights out is the dark theme.
	new MutationObserver( request ).observe( document.documentElement, { attributes: true, attributeFilter: [ 'data-theme' ] } );

	/* ----- the headline word that keeps changing, and the chat ----- */
	var rotator = document.querySelector( '[data-rotator]' );
	if ( rotator && ! still ) {
		var words = rotator.querySelectorAll( '.fx-rotator__word' );
		var n = 0;
		var fit = function () {
			rotator.style.width = words[ n ].offsetWidth + 'px';
		};
		fit();
		window.addEventListener( 'resize', fit );
		setInterval( function () {
			var cur = words[ n ];
			n = ( n + 1 ) % words.length;
			cur.classList.remove( 'is-in' );
			cur.classList.add( 'is-out' );
			words[ n ].classList.remove( 'is-out' );
			words[ n ].classList.add( 'is-in' );
			fit();
			setTimeout( function () {
				cur.classList.remove( 'is-out' );
			}, 600 );
		}, 2200 );
	}
	var chat = document.querySelector( '[data-chat]' );
	if ( chat ) {
		[].forEach.call( chat.querySelectorAll( '.fx-msg, .fx-fix' ), function ( p, i ) {
			p.style.transitionDelay = i * ( still ? 0 : 380 ) + 'ms';
		} );
		new IntersectionObserver( function ( entries, io ) {
			if ( entries[ 0 ].intersectionRatio > 0.6 ) {
				chat.classList.add( 'is-on' );
				io.disconnect();
			}
		}, { threshold: [ 0.6 ] } ).observe( chat );
	}

	// Opening the page on a section link.
	apply();
	if ( active && location.hash ) {
		var first = panels.findIndex( function ( p ) {
			return '#' + p.id === location.hash;
		} );
		if ( first > 0 ) {
			setTimeout( function () {
				goTo( first );
			}, 60 );
		}
	}
	document.fonts && document.fonts.ready.then( function () {
		if ( active ) {
			measure();
			request();
		}
	} );
	window.addEventListener( 'load', function () {
		if ( active ) {
			measure();
			request();
		}
	} );
} )();
