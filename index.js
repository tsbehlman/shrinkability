const { JSDOM, VirtualConsole } = require( "jsdom" );
const { Readability } = require( "moz-readability-node" );

const virtualConsole = new VirtualConsole();

module.exports = function( html, sourceURL ) {
	try {
		dom = new JSDOM( html, {
			url: sourceURL,
			virtualConsole
		} );
		Readability.prototype._cleanClasses = makeSanitizeFunction( dom.window.document );
		return new Readability( dom.window.document ).parse();
	}
	finally {
		dom.window.close();
	}
}

const elementWhitelist = new Set( [ "svg", "VIDEO", "PICTURE" ] );

const defaultAttributeWhitelist = new Set( [ "name" ] );

const attributeWhitelists = new Map( [
	[ "A",   [ "href" ] ],
	[ "IMG", [ "src", "alt", "srcset", "sizes" ] ],
	[ "TH",  [ "colspan", "rowspan" ] ],
	[ "TD",  [ "colspan", "rowspan" ] ]
] );

(function() {
	const defaultAttributes = Array.from( defaultAttributeWhitelist );
	for( const [ tagName, attributes ] of attributeWhitelists ) {
		attributeWhitelists.set( tagName, new Set( defaultAttributes.concat( attributes ) ) );
	}
})();

const collapsibleTags = new Set( [ "SPAN", "DIV" ] );

const ELEMENT_NODE = 1;
const TEXT_NODE    = 3;

const makeSanitizeFunction = document => rootNode => {
	let fringe = Array.from( rootNode.childNodes );
	
	let preDescendantCounter = 0;
	
	do {
		const nodeIsWithinPre = preDescendantCounter > 0;
		preDescendantCounter--;
		let node = fringe.pop();
		
		if( node.nodeType === TEXT_NODE ) {
			if( !nodeIsWithinPre ) {
				node.nodeValue = node.nodeValue.replace( /\s\s+/g, " " );
			}
			continue;
		}
		else if( elementWhitelist.has( node.tagName ) ) {
			continue;
		}
		if( node.nodeType !== ELEMENT_NODE ) {
			removeNode( node );
			continue;
		}
		
		if( node.tagName === "BR" ) {
			if( nodeIsWithinPre ) {
				node.parentNode.insertBefore( document.createTextNode( "\n" ), node );
				removeNode( node );
			}
			continue;
		}
		
		const childNodes = Array.from( node.childNodes );
		
		if( childNodes.length === 0 && node.tagName !== "IMG" ) {
			removeNode( node );
			continue;
		}
		
		if( nodeIsWithinPre ) {
			preDescendantCounter += childNodes.length;
		}
		else if( node.tagName === "PRE" ) {
			preDescendantCounter = childNodes.length;
		}
		
		fringe = fringe.concat( childNodes );
		
		if( nodeIsWithinPre || collapsibleTags.has( node.tagName ) ) {
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
};

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

Readability.prototype.REGEXPS.unlikelyCandidates = new RegExp(
	Readability.prototype.REGEXPS.unlikelyCandidates.source + "|featured|trending",
	Readability.prototype.REGEXPS.unlikelyCandidates.flags
);