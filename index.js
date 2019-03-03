const { JSDOM, VirtualConsole } = require( "jsdom" );
const { Readability } = require( "moz-readability-node" );

const virtualConsole = new VirtualConsole();

module.exports = function( html, sourceURL ) {
	try {
		dom = new JSDOM( html, {
			url: sourceURL,
			virtualConsole
		} );
		const readable = new Readability( dom.window.document ).parse();
		readable.content = readable.content.replace( /\s\s+/g, " " );
		return readable;
	}
	finally {
		dom.window.close();
	}
}

const tagWhitelist = new Set( [ "svg", "VIDEO", "PICTURE" ] );

const defaultAttributeWhitelist = new Set( [ "name" ] );

const attributeWhitelists = new Map( [
	[ "A", [ "href" ] ],
	[ "IMG", [ "src", "alt" ] ],
	[ "TH", [ "colspan", "rowspan" ] ],
	[ "TD", [ "colspan", "rowspan" ] ]
] );

(function() {
	const defaultAttributes = Array.from( defaultAttributeWhitelist );
	for( const [ tagName, attributes ] of attributeWhitelists ) {
		attributeWhitelists.set( tagName, new Set( defaultAttributes.concat( attributes ) ) );
	}
})();

const collapsibleTags = new Set( [ "SPAN", "DIV" ] );

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

function sanitize( rootNode ) {
	let fringe = Array.from( rootNode.childNodes );

	do {
		let node = fringe.pop();

		if( node.nodeType === TEXT_NODE || tagWhitelist.has( node.tagName ) ) {
			continue;
		}
		if( node.nodeType !== ELEMENT_NODE ) {
			removeNode( node );
			continue;
		}

		const childNodes = Array.from( node.childNodes );
		fringe = [ ...fringe, ...childNodes ];

		if( collapsibleTags.has( node.tagName ) ) {
			childNodes.forEach( child => node.parentNode.insertBefore( child, node ) );
			removeNode( node );
			continue;
		}

		let attributeWhitelist = attributeWhitelists.get( node.tagName );
		
		if( attributeWhitelist === undefined ) {
			attributeWhitelist = defaultAttributeWhitelist;
		}

		for( const attribute of Array.from( node.attributes || [] ) ) {
			if( !attributeWhitelist.has( attribute.localName ) ) {
				node.removeAttribute( attribute.name );
			}
		}
	} while( fringe.length > 0 );
}

function removeNode( node ) {
	let parent = node.parentNode;
	do {
		parent.removeChild( node );
		if( parent.firstChild !== null ) {
			return;
		}
		node = parent;
		parent = parent.parentNode;
	} while( parent !== null );
}

Readability.prototype._cleanClasses = sanitize;
Readability.prototype.REGEXPS.unlikelyCandidates = new RegExp(
	Readability.prototype.REGEXPS.unlikelyCandidates.source + "|featured|trending",
	Readability.prototype.REGEXPS.unlikelyCandidates.flags
);