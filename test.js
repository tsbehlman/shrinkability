const fetch = require( "node-fetch" );
const readability = require( "./index.js" );

const [ , , url ] = process.argv;

(async function() {
	const response = await fetch( url );
	const html = await response.text();
	console.log( readability( html, url ).content );
})();