/**
 * Builds the FixPin website into website/dist (bin/publish-site.sh publishes it to GitHub Pages).
 *
 * Pages: home, the Help center generated from ../docs/*.md (so the website and the docs never drift
 * apart), and a 404 page. Same layout, footer and project list as the other project sites.
 *
 * Run from the repository root: node website/build.mjs
 */
import MarkdownIt from 'markdown-it';
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, statSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';

/* ------------------------------------------------------------------ Config */

const SITE = {
	name: 'FixPin',
	url: 'https://george-stathopoulos.github.io/fixpin/',
	base: '/fixpin/', // Used only by 404.html, which GitHub Pages serves from any path.
	author: 'George Stathopoulos',
	authorUrl: 'https://george-stathopoulos.github.io/',
	repo: 'https://github.com/george-stathopoulos/fixpin',
	// The app runs on Cloudflare (see docs/self-hosting.md). Change this one line when it moves.
	app: 'https://fixpin.george-stathopoulos.workers.dev/',
	extRelease: 'https://github.com/george-stathopoulos/fixpin-extension/releases/latest',
	fixpass: 'https://george-stathopoulos.github.io/fixpass/',
	hdh: 'https://george-stathopoulos.github.io/helpdesk-hero/',
};

// Every project site lists the others (and the personal site keeps them all). Keep this list the
// same in each project's website build.
const PROJECTS = [
	{ name: 'Gatehouse', url: 'https://george-stathopoulos.github.io/gatehouse/', text: 'AI governance and cost control for WordPress' },
	{ name: 'Helpdesk Hero', url: 'https://george-stathopoulos.github.io/helpdesk-hero/', text: 'WordPress support with diagnostics and password-free access' },
	{ name: 'Fixpass', url: 'https://george-stathopoulos.github.io/fixpass/', text: 'Spotlight the problem and give support safe, temporary access' },
	{ name: 'FixPin', url: 'https://george-stathopoulos.github.io/fixpin/', text: 'Point at what is broken on any website and share a private link' },
	{ name: 'SheetPilot', url: 'https://george-stathopoulos.github.io/sheetpilot/', text: 'Turn any spreadsheet into an interactive dashboard, in your browser' },
	{ name: 'Expenity', url: 'https://expenity.github.io/expenity/', text: 'Know where your money goes. English and Greek' },
];

const ROOT = process.cwd();
const OUT = join( ROOT, 'website/dist' );
const SRC = join( ROOT, 'website/src' );
const VERSION = JSON.parse( readFileSync( join( ROOT, 'package.json' ), 'utf8' ) ).version;
// Asset links change on every build, so browsers never keep a stale script or stylesheet.
const ASSET_V = VERSION + '.' + Date.now().toString( 36 );

rmSync( OUT, { recursive: true, force: true } );
mkdirSync( OUT, { recursive: true } );
cpSync( join( SRC, 'assets' ), join( OUT, 'assets' ), { recursive: true } );
writeFileSync( join( OUT, '.nojekyll' ), '' );

/* ------------------------------------------------------------------ Images */

// Doc screenshots and animated illustrations: docs/images/* -> assets/img/*.
mkdirSync( join( OUT, 'assets/img' ), { recursive: true } );
const IMG = {};
for ( const f of readdirSync( join( ROOT, 'docs/images' ) ) ) {
	if ( f.startsWith( '.' ) ) continue;
	cpSync( join( ROOT, 'docs/images', f ), join( OUT, 'assets/img', f ) );
	if ( /\.png$/.test( f ) ) {
		const dims = execFileSync( 'sips', [ '-g', 'pixelWidth', '-g', 'pixelHeight', join( ROOT, 'docs/images', f ) ], { encoding: 'utf8' } );
		IMG[ f ] = { w: Number( /pixelWidth: (\d+)/.exec( dims )[ 1 ] ), h: Number( /pixelHeight: (\d+)/.exec( dims )[ 1 ] ) };
	} else {
		const vb = /<svg[^>]*width="(\d+)" height="(\d+)"/.exec( readFileSync( join( ROOT, 'docs/images', f ), 'utf8' ) );
		IMG[ f ] = vb ? { w: Number( vb[ 1 ] ), h: Number( vb[ 2 ] ) } : { w: 0, h: 0 };
	}
}

/* ------------------------------------------------------------------ Helpers */

const esc = ( s ) => String( s ).replace( /&/g, '&amp;' ).replace( /</g, '&lt;' ).replace( />/g, '&gt;' ).replace( /"/g, '&quot;' );
const slug = ( t ) =>
	t
		.toLowerCase()
		.replace( /<[^>]+>/g, '' )
		.replace( /[^\p{L}\p{N}\s_-]/gu, '' )
		.trim()
		.replace( /\s/g, '-' );

const svg = ( d, size = 22 ) => `<svg width="${ size }" height="${ size }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ d }</svg>`;
const I = {
	playSm: svg( '<circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z"/>', 18 ),
	sun: svg( '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', 18 ),
	menu: svg( '<path d="M4 7h16M4 12h16M4 17h16"/>', 20 ),
	download: svg( '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', 18 ),
	play: svg( '<circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z"/>' ),
	key: svg( '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>' ),
	spot: svg( '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/>' ),
	shield: svg( '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>' ),
	wrench: svg( '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2.6-.4-.4-2.6z"/>' ),
	help: svg( '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>' ),
	users: svg( '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>' ),
	code: svg( '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13 4l-2 20"/>' ),
};

/* ------------------------------------------------------------------ Layout */

const NAV = [
	{ id: 'how', label: 'How it works', href: 'index.html#how' },
	{ id: 'features', label: 'Features', href: 'index.html#features' },
	{ id: 'get', label: 'Get it', href: 'index.html#get' },
	{ id: 'wordpress', label: 'WordPress', href: 'index.html#wordpress' },
	{ id: 'docs', label: 'Help center', href: 'docs/' },
];

function logo() {
	return 'FixPin';
}

function layout( { title, description, root, current = '', body, canonical = '', extraHead = '', home = false } ) {
	const full = title === SITE.name ? `${ SITE.name }: show them where it breaks` : `${ title } · ${ SITE.name }`;
	const fix = ( href ) => ( root === '' && href.startsWith( 'index.html#' ) ? href.slice( 10 ) : root + href );
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${ esc( full ) }</title>
<meta name="description" content="${ esc( description ) }">
<meta name="theme-color" content="#2f5bd8">
<link rel="canonical" href="${ SITE.url }${ canonical }">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${ SITE.name }">
<meta property="og:title" content="${ esc( full ) }">
<meta property="og:description" content="${ esc( description ) }">
<meta property="og:url" content="${ SITE.url }${ canonical }">
<meta property="og:image" content="${ SITE.url }assets/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${ root }assets/favicon.svg" type="image/svg+xml">
<!-- Cloudflare Web Analytics: counts visits anonymously, no cookies --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "64332b427a604e879f82853393ebdb0d"}'></script><!-- End Cloudflare Web Analytics -->
<link rel="stylesheet" href="${ root }assets/site.css?v=${ ASSET_V }">
<link rel="stylesheet" href="${ root }assets/home.css?v=${ ASSET_V }">
<link rel="stylesheet" href="${ root }assets/fixpin.css?v=${ ASSET_V }">
${ home ? `<link rel="stylesheet" href="${ root }assets/scroll.css?v=${ ASSET_V }">` : '' }
<script>try{localStorage.removeItem('hdh-site-theme');var t=sessionStorage.getItem('hdh-site-theme');document.documentElement.dataset.theme=t==='light'?'light':'dark';}catch(e){document.documentElement.dataset.theme='dark';}</script>
${ extraHead }
<!-- Cloudflare Web Analytics: counts visits anonymously, no cookies --><script type='module' src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "64332b427a604e879f82853393ebdb0d"}'></script><!-- End Cloudflare Web Analytics -->
</head>
<body data-root="${ root }"${ home ? ' class="is-home"' : '' }>
<a class="skip" href="#main">Skip to content</a>
<header class="site-head">
	<div class="wrap">
		<a class="brand" href="${ root || './' }">${ logo() }</a>
		<nav id="site-nav" class="nav" aria-label="Main">
			${ NAV.map( ( n ) => `<a href="${ fix( n.href ) }"${ current === n.id ? ' aria-current="page"' : '' }>${ n.label }</a>` ).join( '\n\t\t\t' ) }
		</nav>
		<div class="head-actions">
			<button class="icon-btn" type="button" data-theme-toggle aria-label="Dark theme" aria-pressed="false">${ I.sun }</button>
			<a class="btn btn-primary btn-sm" href="${ SITE.app }">${ I.playSm } Open the app</a>
			<button class="icon-btn menu-btn" type="button" data-menu-toggle aria-controls="site-nav" aria-expanded="false" aria-label="Menu">${ I.menu }</button>
		</div>
	</div>
</header>
<main id="main">
${ body }
</main>
<footer class="site-foot">
	<div class="wrap">
		<div class="foot-grid">
			<div class="foot-about">
				<a class="brand" href="${ root || './' }">${ logo() }</a>
				<p>Point at what's broken on any website or app, and share a private link that deletes itself. Free and open source (GPL).</p>
			</div>
			<div>
				<h2>Product</h2>
				<ul>
					<li><a href="${ fix( 'index.html#how' ) }">How it works</a></li>
					<li><a href="${ fix( 'index.html#features' ) }">Features</a></li>
					<li><a href="${ SITE.app }">Open the app</a></li>
					<li><a href="${ SITE.extRelease }">Browser extension</a></li>
					<li><a href="${ root }changelog/">Changelog</a></li>
					<li><a href="${ SITE.repo }">Source code</a></li>
				</ul>
			</div>
			<div>
				<h2>Help</h2>
				<ul>
					<li><a href="${ root }docs/">Help center</a></li>
					<li><a href="${ root }docs/getting-started/">Getting started</a></li>
					<li><a href="${ root }docs/extension/">The extension</a></li>
					<li><a href="${ root }docs/faq/">FAQ</a></li>
				</ul>
			</div>
			<div>
				<h2>More projects</h2>
				<ul>
					${ PROJECTS.filter( ( p ) => p.name !== SITE.name ).map( ( p ) => `<li><a href="${ p.url }" title="${ esc( p.text ) }">${ esc( p.name ) }</a></li>` ).join( '' ) }
					<li><a href="${ SITE.authorUrl }#projects">All projects</a></li>
					<li><a href="https://george-stathopoulos.github.io/blog/" title="The story behind every project">Blog</a></li>
				</ul>
			</div>
			<div>
				<h2>Trust</h2>
				<ul>
					<li><a href="${ root }docs/privacy/">Privacy</a></li>
					<li><a href="${ root }docs/self-hosting/">Host your own</a></li>
					<li><a href="${ SITE.repo }/security/advisories/new">Report a vulnerability</a></li>
					<li><a href="${ SITE.repo }/issues">Feedback and ideas</a></li>
				</ul>
			</div>
		</div>
		<div class="foot-bottom">
			<span>Made with <span class="heart" role="img" aria-label="love">♥</span> by <a href="${ SITE.authorUrl }">${ SITE.author }</a></span>
			<span>FixPin ${ VERSION } · This website uses no cookies. Visits are counted anonymously, with no personal data.</span>
		</div>
	</div>
</footer>
<script src="${ root }assets/site.js?v=${ ASSET_V }" defer></script>
<script src="${ root }assets/share-heart.js?v=${ ASSET_V }" data-site="fixpin" data-url="${ SITE.url }" data-msg="Found a bug? So will your friends. Share the pin." defer></script>
${ home ? `<script src="${ root }assets/scroll.js?v=${ ASSET_V }" defer></script>` : '' }
</body>
</html>
`;
}

function write( path, html ) {
	const file = join( OUT, path );
	mkdirSync( dirname( file ), { recursive: true } );
	writeFileSync( file, html );
}

/* ------------------------------------------------------------------ Help center (docs) */

const GROUPS = [
	{ label: 'Start here', pages: [ 'getting-started', 'extension' ] },
	{ label: 'Using FixPin', pages: [ 'sharing', 'privacy', 'faq' ] },
	{ label: 'For developers', pages: [ 'self-hosting', 'developers' ] },
];
const ORDER = GROUPS.flatMap( ( g ) => g.pages );
const BLURB = {
	'getting-started': 'Your first report in a minute, and how to install the app.',
	extension: 'Install the browser extension and capture a problem in one click.',
	sharing: 'Links, expiry, passcodes and deleting a report early.',
	privacy: 'What is stored, for how long, and who can see it.',
	faq: 'Quick answers to the most common questions.',
	'self-hosting': 'Run your own FixPin on a free Cloudflare account.',
	developers: 'The API, the report format and the storage.',
};
const ICON = {
	'getting-started': I.play,
	extension: I.spot,
	sharing: I.key,
	privacy: I.shield,
	faq: I.help,
	'self-hosting': I.wrench,
	developers: I.code,
};

const docs = {};
const searchIndex = [];

for ( const name of ORDER ) {
	const md = new MarkdownIt( { html: false, linkify: false, typographer: false } );
	const headings = [];
	const used = {};
	let title = name;
	md.core.ruler.push( 'fxp', ( state ) => {
		state.tokens.forEach( ( tok, i ) => {
			if ( tok.type === 'heading_open' ) {
				const text = state.tokens[ i + 1 ].content;
				let id = slug( text );
				used[ id ] = ( used[ id ] || 0 ) + 1;
				if ( used[ id ] > 1 ) id += '-' + ( used[ id ] - 1 );
				tok.attrSet( 'id', id );
				if ( tok.tag === 'h1' ) title = text;
				else headings.push( { level: tok.tag, id, text: text.replace( /[`*]/g, '' ) } );
			}
			( state.tokens[ i ].children || [] ).forEach( ( c ) => {
				if ( c.type === 'image' ) {
					const m = /images\/([\w.-]+)$/.exec( c.attrGet( 'src' ) );
					if ( ! m || ! IMG[ m[ 1 ] ] ) throw new Error( `docs/${ name }.md: missing image ${ c.attrGet( 'src' ) }` );
					c.attrSet( 'src', `../../assets/img/${ m[ 1 ] }` );
					if ( IMG[ m[ 1 ] ].w ) {
						c.attrSet( 'width', String( IMG[ m[ 1 ] ].w ) );
						c.attrSet( 'height', String( IMG[ m[ 1 ] ].h ) );
					}
					c.attrSet( 'loading', 'lazy' );
					c.attrSet( 'decoding', 'async' );
				}
				if ( c.type === 'link_open' ) {
					// The docs use GitHub-friendly links (other-guide.md#section); on the site they're pages.
					const href = c.attrGet( 'href' );
					const m = /^([a-z0-9-]+)\.md(#.+)?$/i.exec( href );
					if ( m ) c.attrSet( 'href', m[ 1 ] === 'README' ? `../${ m[ 2 ] || '' }` : `../${ m[ 1 ] }/${ m[ 2 ] || '' }` );
					else if ( /^\.\.\//.test( href ) ) c.attrSet( 'href', `${ SITE.repo }/blob/main/${ href.slice( 3 ) }` );
					else if ( /^https?:/.test( href ) ) c.attrSet( 'rel', 'noopener' );
				}
			} );
		} );
	} );
	const src = readFileSync( join( ROOT, 'docs', name + '.md' ), 'utf8' );
	let html = md.render( src );
	html = html
		.replace( /<p>(<img [^>]*alt="([^"]*)"[^>]*>)<\/p>/g, '<figure data-zoom>$1<figcaption>$2</figcaption></figure>' )
		.replace( /<pre>/g, '<pre tabindex="0">' )
		.replace( /<table>/g, '<table tabindex="0">' )
		.replace( /<(h[23]) id="([^"]+)">(.*?)<\/\1>/g, '<$1 id="$2">$3<a class="anchor" href="#$2" aria-label="Link to this section">#</a></$1>' );
	docs[ name ] = { title, html, headings, src };

	// Search entries: the page itself and each section.
	const plain = ( s ) => s.replace( /\[([^\]]+)\]\([^)]*\)/g, '$1' ).replace( /[`*_>#|]/g, ' ' ).replace( /:?-{3,}:?/g, ' ' ).replace( /\s+/g, ' ' ).trim();
	src.split( /\n(?=#{2,3} )/ ).forEach( ( part, i ) => {
		const m = /^(#{1,3}) (.+)\n/.exec( part.startsWith( '#' ) ? part : '# ' + title + '\n' + part );
		const heading = i === 0 ? '' : m ? m[ 2 ] : '';
		const id = heading ? headings.find( ( h ) => h.text === heading.replace( /[`*]/g, '' ) )?.id || '' : '';
		searchIndex.push( {
			t: title,
			s: heading.replace( /[`*]/g, '' ),
			u: `docs/${ name }/${ id ? '#' + id : '' }`,
			x: plain( part.replace( /^#{1,3} .+\n/, '' ) ).slice( 0, 600 ),
		} );
	} );
}

// site.js reads the search index from this global (shared with the other project sites).
writeFileSync( join( OUT, 'assets/search-index.js' ), 'window.HDH_SEARCH=' + JSON.stringify( searchIndex ) + ';' );

function searchBox( id, placeholder ) {
	return `<div class="search" data-search role="search">
	<label class="sr" for="${ id }">Search the help center</label>
	<input id="${ id }" type="search" placeholder="${ esc( placeholder ) }" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${ id }-results">
	<ul class="search-results" id="${ id }-results" role="listbox" aria-label="Search results" hidden></ul>
	<p class="sr" role="status" aria-live="polite"></p>
</div>`;
}

const SEARCH_SCRIPT = ( root ) => `<script src="${ root }assets/search-index.js?v=${ ASSET_V }" defer></script>`;

function docsNav( current ) {
	return `<aside class="docs-nav" aria-label="Help center">
	${ searchBox( 'side-search', 'Search help…' ) }
	<details open>
		<summary class="docs-nav-toggle">Browse all guides</summary>
		<ul><li><a href="../"${ current === '' ? ' aria-current="page"' : '' }>Help center home</a></li></ul>
		${ GROUPS.map( ( g ) => `<h2>${ g.label }</h2><ul>${ g.pages.map( ( p ) => `<li><a href="../${ p }/"${ current === p ? ' aria-current="page"' : '' }>${ esc( docs[ p ].title ) }</a></li>` ).join( '' ) }</ul>` ).join( '\n\t\t' ) }
	</details>
</aside>`;
}

ORDER.forEach( ( name, i ) => {
	const d = docs[ name ];
	const prev = ORDER[ i - 1 ];
	const next = ORDER[ i + 1 ];
	const toc = d.headings.filter( ( h ) => h.level === 'h2' );
	const body = `<div class="wrap docs-layout">
${ docsNav( name ) }
<article class="doc">
	<nav class="crumbs" aria-label="Breadcrumb"><a href="../">Help center</a> › ${ esc( d.title ) }</nav>
	${ d.html }
	<div class="help-strip"><p><strong>Still stuck?</strong> Check the <a href="../faq/">FAQ</a>, or <a href="${ SITE.repo }/issues">ask on GitHub</a>.</p></div>
	<nav class="pager" aria-label="Previous and next guide">
		${ prev ? `<a class="prev" href="../${ prev }/"><small>Previous</small>${ esc( docs[ prev ].title ) }</a>` : '' }
		${ next ? `<a class="next" href="../${ next }/"><small>Next</small>${ esc( docs[ next ].title ) }</a>` : '' }
	</nav>
</article>
${ toc.length > 1 ? `<nav class="on-page" aria-label="On this page" data-spy><h2>On this page</h2><ul>${ toc.map( ( h ) => `<li><a href="#${ h.id }">${ esc( h.text ) }</a></li>` ).join( '' ) }</ul></nav>` : '<div></div>' }
</div>`;
	write(
		`docs/${ name }/index.html`,
		layout( { title: d.title, description: BLURB[ name ] + ' FixPin help center.', root: '../../', current: 'docs', canonical: `docs/${ name }/`, body, extraHead: SEARCH_SCRIPT( '../../' ) } )
	);
} );

// Help center home.
{
	const popular = [
		[ 'getting-started', 'your-first-report-the-app', 'Your first report' ],
		[ 'extension', 'use-it', 'Use the extension' ],
		[ 'sharing', 'passcode', 'Add a passcode' ],
		[ 'sharing', 'delete-it-early', 'Delete a report early' ],
		[ 'privacy', '', 'What is stored, and for how long' ],
		[ 'self-hosting', '', 'Host your own FixPin' ],
	];
	const body = `<section class="docs-hero">
	<div class="wrap">
		<h1>How can we help?</h1>
		<p>Guides and answers for FixPin: the app, the browser extension, sharing and privacy.</p>
		${ searchBox( 'hero-search', 'Search, e.g. “passcode”, “extension”, “expire”' ) }
	</div>
</section>
<div class="wrap docs-groups">
	<h2>Popular</h2>
	<div class="grid-3">
		${ popular.map( ( [ p, a, label ] ) => `<a class="card" href="${ p }/${ a ? '#' + a : '' }"><h3>${ esc( label ) }</h3><p>${ esc( docs[ p ].title ) }</p><span class="more">Read the guide →</span></a>` ).join( '\n\t\t' ) }
	</div>
	${ GROUPS.map( ( g ) => `<h2>${ g.label }</h2>
	<div class="grid-3">
		${ g.pages.map( ( p ) => `<a class="card" href="${ p }/"><span class="ic">${ ICON[ p ] }</span><h3>${ esc( docs[ p ].title ) }</h3><p>${ esc( BLURB[ p ] ) }</p></a>` ).join( '\n\t\t' ) }
	</div>` ).join( '\n\t' ) }
</div>`;
	write( 'docs/index.html', layout( { title: 'Help center', description: 'Guides and answers for FixPin: the app, the browser extension, sharing and privacy.', root: '../', current: 'docs', canonical: 'docs/', body, extraHead: SEARCH_SCRIPT( '../' ) } ) );
}

/* ------------------------------------------------------------------ Home */

{
	const body = readFileSync( join( SRC, 'home.html' ), 'utf8' )
		.replace( /\{\{app\}\}/g, SITE.app ).replace( /\{\{extRelease\}\}/g, SITE.extRelease )
		.replace( /\{\{fixpass\}\}/g, SITE.fixpass ).replace( /\{\{hdh\}\}/g, SITE.hdh );
	write( 'index.html', layout( { title: SITE.name, description: 'FixPin is free: point at what is broken on any website, add a note, and share a private link that deletes itself. App and browser extension.', root: '', current: '', body, home: true } ) );
}

/* ------------------------------------------------------------------ Changelog */

{
	const md = new MarkdownIt( { html: false } );
	const log = readFileSync( join( ROOT, 'CHANGELOG.md' ), 'utf8' ).replace( /^# .*\n+(All notable[^\n]*\n+)?/, '' );
	const body = `
<section class="page-head"><div class="wrap"><span class="kicker">Changelog</span><h1>What's new</h1><p>Every change to the FixPin app, website and browser extension, newest first.</p></div></section>
<div class="wrap" style="padding:64px 24px 120px"><div class="prose">${ md.render( log ) }</div></div>`;
	write( 'changelog/index.html', layout( { title: 'Changelog', description: 'Release notes for the FixPin app and browser extension.', root: '../', canonical: 'changelog/', body } ) );
}

/* ------------------------------------------------------------------ 404, sitemap, robots */

{
	const body = `<section class="page-head" style="border:0;text-align:center;padding:120px 0"><div class="wrap"><span class="kicker">404</span><h1>Nothing pinned here</h1><p style="margin:0 auto 28px">This page may have moved. Try the help center, or start from the home page.</p><div class="cta-row"><a class="btn btn-primary" href="${ SITE.base }">Home</a><a class="btn btn-ghost" href="${ SITE.base }docs/">Help center</a></div></div></section>`;
	write( '404.html', layout( { title: 'Page not found', description: 'Page not found.', root: SITE.base, body } ) );
	const urls = [ '', 'changelog/', 'docs/', ...ORDER.map( ( p ) => `docs/${ p }/` ) ];
	write( 'sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${ urls.map( ( u ) => `<url><loc>${ SITE.url }${ u }</loc></url>` ).join( '\n' ) }\n</urlset>\n` );
	write( 'robots.txt', `User-agent: *\nAllow: /\nSitemap: ${ SITE.url }sitemap.xml\n` );
}

console.log( `website/dist built: ${ ORDER.length } help pages, ${ searchIndex.length } search entries, version ${ VERSION }` );
