function parseFile( file, callbackRead, callbackDone ) {

    const encode = 'UTF-8';
    const bufferSize = 30* 1024;

    var fileSize   = file.size;
    var chunkSize  = Math.min( bufferSize, fileSize); // bytes

    var offset     = 0;
    var offStr     = "";
    var chunkReaderBlock = null;

    var readEventHandler = function( evt ) {

        if ( evt.target.error == null ) {

            var s = offStr + event.target.result;
            offStr = "";

            offset += evt.loaded;

            if ( offset < fileSize ) {

                var lineEnd = s.lastIndexOf( "\n" );
                if ( lineEnd > 0 ) {

                    offStr = s.slice( lineEnd );
                    s = s.slice(0, lineEnd);
                }
            }

            callbackRead( s ); // callback for handling read chunk
        } else {

            console.log( "Read error: " + evt.target.error );
            return;
        }
        if ( offset >= fileSize ) {

            callbackDone();
            console.log( "Done reading file" );
            return;
        }

        // of to the next chunk
        chunkReaderBlock( offset, chunkSize, file );
    };

    chunkReaderBlock = function( _offset, length, _file ) {

        length = _offset+length > fileSize ? fileSize - _offset : length;

        if ( length <= 0 )
            return;

        var r = new FileReader();
        var blob = _file.slice( _offset, length + _offset );
        r.onload = readEventHandler;
        r.readAsText( blob, encode );
    };

    // now let's start the read with the first block
    chunkReaderBlock( offset, chunkSize, file );
}