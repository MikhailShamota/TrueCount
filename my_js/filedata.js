function parseFile( file, callback ) {

    const chunkSize  = 1 * 1024; // bytes
    const encode = 'Windows-1251';

    var fileSize   = file.size;
    var offset     = 0;
    //var self       = this; // we need a reference to the current object
    var chunkReaderBlock = null;

    var readEventHandler = function( evt ) {

        if ( evt.target.error == null ) {

            var s = event.target.result;
            var lineEnd = s.lastIndexOf("\n");
            lineEnd > 0 ? s = s.slice( 0, lineEnd ) : s;

            offset += s.length;
            callback( s ); // callback for handling read chunk
        } else {

            console.log( "Read error: " + evt.target.error );
            return;
        }
        if (offset >= fileSize) {

            console.log( "Done reading file" );
            return;
        }

        // of to the next chunk
        chunkReaderBlock( offset, chunkSize, file );
    };

    chunkReaderBlock = function( _offset, length, _file ) {

        var r = new FileReader();
        var blob = _file.slice( _offset, length + _offset );
        r.onload = readEventHandler;
        r.readAsText( blob, encode );
    };

    // now let's start the read with the first block
    chunkReaderBlock( offset, chunkSize, file );
}