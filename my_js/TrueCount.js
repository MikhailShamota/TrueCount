/**
 * Created by mshamota on 11.11.2016.
 */
var TrueCount = ( function () {

    var instance;

    const STYLELINE = {

        NONE: 0,
        STRAIGHT: 1,
        CURVE: 2
    };

    const v3Zero  = new THREE.Vector3( 0, 0, 0 );
    const v3UnitX = new THREE.Vector3( 1, 0, 0 );
    const v3UnitY = new THREE.Vector3( 0, 1, 0 );
    const v3UnitZ = new THREE.Vector3( 0, 0, 1 );

    const worldSize = 1000;
    const mountianSize = 20;//worldSize+mountianSize
//    const defaultDensity = 0.35;

    const SceneElementOpacity = 0.75;
    const SceneElementFadeOpacity = 0.75;

    const BranchesLineStyle = STYLELINE.CURVE;
    const BRANCH_WIDTH_MAX = 200;
    const BRANCH_WIDTH_MIN = 4;
    const LABEL_SIZE = 400;
    const NODE_MAX_BRIGHTNESS = 1;
    const NODE_MIN_BRIGHTNESS = 0.5;
    const NODE_MAX_SIZE = 20;
    const NODE_MIN_SIZE = 0.5;

    const PERFORMANCE_BRANCHES_LIMIT = 1000;

    //var BranchesLineStyle = STYLELINE.STRAIGHT;

    var stats, controls;
    var camera, renderer, scene;
    var octree;

    var BranchesMesh;
    var BranchesMeshShowed;
    var NodesMesh;
    var NodesMeshShowed;

    var Materials;

    var metrics = function() {

        this.max = Number.MIN_SAFE_INTEGER;
        this.min = Number.MAX_SAFE_INTEGER;
        this.index = [];

        this.set = function( key, value ) {

            this.max = Math.max( value, this.max );
            this.min = Math.min( value, this.min );

            if ( !this.index[ value ] )
                this.index[ value ] = [];

            this.index[ value ].push( key );
        };

        this.normalize  = function( p ) {

            return ( p - this.min ) / ( ( this.max - this.min ) || 1 ) || 0;
        };
    };

    var Info = {

        nodes : {

            weights : new metrics(),
            links: new metrics()
        },
        branches : {

            weights : new metrics(),
            counts : new metrics()
        }
    };

    var Nodes = {};
    var Branches = {};

    function Node( id ) {

        this.id = id;
        this.weight = 0;
        this.document = null;
        this.in = 0;
        this.out = 0;
        this.visible = true;
        this.label = false;

        this.pos = undefined;
        this.color = undefined;

        this.position = new THREE.Vector3();

        this.branches = function() {

            return Branches[this.id];
        };

        this.getBrightness = function() {

            return Info.nodes.links.normalize( this.out + this.in ) * ( NODE_MAX_BRIGHTNESS - NODE_MIN_BRIGHTNESS ) + NODE_MIN_BRIGHTNESS;
        };

        this.getSize = function() {

            return this.weight && Info.nodes.weights.normalize( this.weight ) * ( NODE_MAX_SIZE - NODE_MIN_SIZE ) + NODE_MIN_SIZE || this.visible && 1 || 0;
            //return this.weight && Math.pow( this.weight, 1/3 ) / defaultDensity || this.visible && 1 || 0;// * defaultDocumentSize / defaultDocumentDensity;
        };

        this.getColor = function() {

            return this.color && new THREE.Color( this.color ) || new THREE.Color( 0.15, 0.25, 0.15 );
        };

        this.getPosition = function() {

            function getRandomUnitVector( length ) {

                return new THREE.Vector3( 1, 0, 0 ).clone().applyEuler(
                    new THREE.Euler(
                        Math.random() * 2 * Math.PI,
                        Math.random() * 2 * Math.PI,
                        Math.random() * 2 * Math.PI,
                        'XYZ')
                ).multiplyScalar( length );
            }

            return this.pos || getRandomUnitVector( /*this.parent && this.parent.size || 0*/worldSize + ( Branches.maxCount > 0 ? mountianSize * 0.5 * ( this.in+this.out ) / Branches.maxCount : 0 ) );//.add(this.parent && this.parent.position || v3Zero);
        };
    }

    function setNodesPositions() {

        $.each( Nodes, function ( id, node ) {

            node.position.copy( node.getPosition() );
            node.size = node.getSize();
            node.brightness = node.getBrightness();
            node.color = node.getColor();

            octree.addObjectData( node.id, node );//<--overrided / add and upd
        });
    }

    function updateMetrics() {

        $.each( Nodes, function ( id, node ) {

            Info.nodes.weights.set( node.id, node.weight );
            Info.nodes.links.set( node.id, node.in + node.out );
        });

        $.each( Branches, function ( src, branchFrom ) {

            for ( var dstId in branchFrom ) {

                var branch = branchFrom[ dstId ];
                Info.branches.weights.set( [ branch.src, branch.dst ], branch.weight );
                Info.branches.counts.set( [ branch.src, branch.dst ], branch.count );
            }
        });
    }

    function addParticles( material ) {

        var count = Object.keys( Nodes ).length || 0;
        var sizes = new Float32Array( count );
        var brightness = new Float32Array( count );
        var positions = new Float32Array( count * 3 );
        var colors = new Float32Array( count * 3 );
        var i = 0;

        $.each( Nodes, function ( id, node ) {

            node.position.toArray( positions, i * 3 );
            sizes[ i ] = node.size;
            brightness[ i ] = node.brightness;
            node.color.toArray( colors, i * 3);

            node.geometryIndex = i;

            i++;
        } );

        var geometry = new THREE.BufferGeometry();
        geometry.addAttribute( "position", new THREE.BufferAttribute( positions, 3 ) );
        geometry.addAttribute( "customSize", new THREE.BufferAttribute( sizes, 1 ) );
        geometry.addAttribute( "customBrightness", new THREE.BufferAttribute( brightness, 1 ) );
        geometry.addAttribute( "customColor", new THREE.BufferAttribute( colors, 3 ) );

        //geometry.dynamic = true;

        var particles = new THREE.Points( geometry, material );

        scene.add( particles );

        return particles;
    }

    function addLabel( node ) {

        function label( txt, billboardSize ) {

            var canvas = document.createElement( "canvas" );
            canvas.width = canvas.height = 512;//четкость зависит от

            var context = canvas.getContext( "2d" );

            var fontSizes = [72, 50, 36, 28, 20, 14, 12, 10, 8, 6, 5, 4, 3, 2],
                textDimensions,
                i = 0;

            do {

                context.font = "Bold " + fontSizes[i++] + 'px Arial Narrow';
                textDimensions = context.measureText( txt );
            } while ( textDimensions.width >= canvas.width );

            context.fillStyle = 'White';
            context.textAlign = "center";
            context.textBaseline = "middle";

            //txt = txt.split( '' ).sort( function(){return 0.5-Math.random()} ).join( '' );

            context.fillText( txt, canvas.width / 2, canvas.height / 2 );

            var texture = new THREE.Texture( canvas );
            texture.needsUpdate = true;

            var material = Materials.label.clone();
            material.map = texture;

            var sprite = new THREE.Sprite( material );
            sprite.scale.set( billboardSize, billboardSize, 1 );

            return sprite;
        }

        if ( node.label )
            return;

        var sprite = label( node.alias || node.id, /*node.size * 2*/ LABEL_SIZE /*R x 2*/ );
        sprite.position.set( node.position.x, node.position.y, node.position.z).multiplyScalar( 1.2 );
        sprite.frustumCulled = false;
        //sceneNodes.add( sprite );
        scene.add( sprite );
        node.label = true;
    }

    /**if node exists its data will be overritten!*/
    function loadNode( node ) {

        var id = node.id;
        var weight = node.weight || Nodes[id] && Nodes[id].weight || 0;
        var doc = node.document || Nodes[id] && Nodes[id].document;
        var alias = node.alias || Nodes[id] && Nodes[id].alias;
        var pos = node.x && node.y && node.z && new THREE.Vector3( node.x, node.y, node.z );
        var color = node.color || Nodes[id] && Nodes[id].color;

        //var size = parent && parent.childSize || worldSize;//размер для элементов внутри parent
        //var sizeWeighted = weight2size( weight ) ;//размер на основании веса объекта
        //if ( parent && !parent.sizeScale )
          //  parent.sizeScale = size / sizeWeighted;//первое значение в выборке самое большое. масштаб всех элементов группировки
        //size = sizeWeighted * ( parent && parent.sizeScale || size / sizeWeighted );//итоговый размер - размер нормализованный по самому больщому элементу ( i=0 )

        var obj = Nodes[id] || new Node( id );

        obj.weight = weight;
        //obj.childSize = defaultDensity * size / sizeWeighted;//размер для элементов внутри
        obj.document = doc;
        obj.alias = alias;
        obj.pos = pos;
        obj.color = color;

        Nodes[id] = obj;

        return obj;
    }

    function fade( value ) {

        var opacity = SceneElementOpacity * ( 1 - value ) + value * SceneElementFadeOpacity;

        Materials.branch.uniforms.opacity.value = opacity;
        Materials.node.uniforms.opacity.value = opacity;
    }

    function loadBranch( branch ) {

        //branch.src;
        //branch.dst;
        //branch.doc;
        //branch.weight;
        //self linked are not allowed
        if ( branch.src == branch.dst )
            return;

        function load( b ) {

            if ( !Branches[b.src] )
                Branches[b.src] = [];

            if ( Branches[b.src][b.dst] ) {

                Branches[b.src][b.dst].weight += b.weight;
                Branches[b.src][b.dst].count++;
            } else {

                Branches[b.src][b.dst] = b;
                Branches[b.src][b.dst].count = 1;
            }
        }

        load( { src:branch.src, dst:branch.dst, doc:branch.doc, weight:branch.weight || 1 } );
        load( { src:branch.dst, dst:branch.src, doc:branch.doc, weight:branch.weight || 1 } );

        loadNode( { id: branch.src } ).out++;
        loadNode( { id: branch.dst } ).in++;
    }

    function addLines( material ) {

        function link( from, to, material ) {

            var v1 = from.position;
            var v2 = to.position;

            var s2 = ( BRANCH_WIDTH_MAX - BRANCH_WIDTH_MIN ) * Info.branches.weights.normalize( Branches[from.id][to.id].weight ) + BRANCH_WIDTH_MIN;
            var s1 = Math.min( from.size, s2 );
            var s3 = Math.min( to.size, s2 );
            var center = v3Zero.clone();

            var curve = new THREE.QuadraticBezierCurve3(v1, center, v2);
            var geometry = new THREE.Geometry();
            //TODO:
            //geometry.dynamic = true;

            switch ( BranchesLineStyle ) {

                case STYLELINE.NONE:
                    break;

                case STYLELINE.CURVE:
                    geometry.vertices = curve.getPoints(20);
                    break;

                case STYLELINE.STRAIGHT:
                    geometry.vertices.push( v1, v2 );//straight line
                    break;
            }

            var line = new THREE.MeshLine();
            line.setGeometry(

                geometry,
                function( p ) { return s3 * p + s1 * ( 1 - p ) + s2 * ( 1 - Math.abs( (p - 0.5) / 0.5 ) ) }//size changes linear from start to end
            );

            return new THREE.Mesh( line.geometry, material );
        }

        var mesh = new THREE.Mesh();
        var limit = PERFORMANCE_BRANCHES_LIMIT;

        //$.each( Nodes, function ( key, val ){

        var weights = Object.keys( Info.branches.weights.index );

        weights.sort( function( a, b ) {
            return Number(a) < Number(b) ? 1 : a == b ? 0 :  -1;
        });

        for ( var i = 0; i < weights.length; i++ ) {

            //var branches = val.branches();
            //var branches = Info.branches.weights.index[ weight ];
            var branches = Info.branches.weights.index[ weights[ i ] ];

            branches.forEach( function ( v ) {

                var srcNode = Nodes[ v[ 0 ] ];
                var dstNode = Nodes[ v[ 1 ] ];

                if ( !srcNode || !dstNode || !srcNode.visible || !dstNode.visible || limit < 0 )
                    return;

                if ( srcNode.id == dstNode.id )
                    return;//TODO: явно обрабатывать ссылку узла на себя, пока исключаем, считаем узлы самодостижимыми

                mesh.add( link( srcNode, dstNode, material ) );
                limit--;

                if ( !BranchesMesh )//TODO:
                    v.meshIndex = mesh.children.length - 1;

                //i++;
           });
        }//);

        //sceneBranches.add( mesh );
        mesh.frustumCulled = false;
        scene.add( mesh );

        return mesh;
    }

    /**recursive*/
    function getLinkedNodes( nodeFrom, pathOfNodes ) {

        if ( !nodeFrom || pathOfNodes[nodeFrom.id] )
            return;//если узел уже найден - исключение закцикливания явного и неявного

        pathOfNodes[nodeFrom.id] = nodeFrom;

        if ( !Branches[nodeFrom.id] )
            return;//если нет дальнейших шагов

        for ( var dstId in Branches[nodeFrom.id] ) {

            getLinkedNodes( Nodes[dstId], pathOfNodes );
        }
    }

    function showLinked( nodeFrom ) {

        var pathOfNodes = {};

        getLinkedNodes( nodeFrom, pathOfNodes );

        scene.remove( BranchesMeshShowed );
        scene.remove( NodesMeshShowed );

        //draw links
        BranchesMeshShowed = addLinks( pathOfNodes, Materials.branchShow );

        //draw nodes
        NodesMeshShowed = addParticles( pathOfNodes, Materials.nodeShow );

        $.each( pathOfNodes, function( id, node ) {

            addLabel( node );
        } );

        fade( nodeFrom && 1 || 0 );//если не передан начальный узел - восстанавливаем свечение
    }

    function update() {

        controls.update(); // required if controls.enableDamping = true, or if controls.autoRotate = true
        stats.update();
    }

    function initGL() {

        scene = new THREE.Scene();

        var WIDTH = window.innerWidth, HEIGHT = window.innerHeight;

        camera = new THREE.PerspectiveCamera( 75, window.width / window.height, 0.1, 1000000 );
        camera.position.z = 3750;
        camera.aspect = WIDTH / HEIGHT;
        camera.updateProjectionMatrix();

        window.addEventListener( 'resize', function() {
            var WIDTH = window.innerWidth, HEIGHT = window.innerHeight;

            renderer.setSize( WIDTH, HEIGHT );
            camera.aspect = WIDTH / HEIGHT;
            camera.updateProjectionMatrix();
        } );

        renderer = new THREE.WebGLRenderer( {antialias:true} );
        renderer.setSize( WIDTH, HEIGHT );
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.sortObjects = false;
        renderer.domElement.addEventListener( "click", onMouseClick );
        renderer.domElement.addEventListener( "dblclick", onMouseDblClick );

        document.body.appendChild( renderer.domElement );

        scene.background = new THREE.Color( 0x181818 );
        //sceneNodes.background = new THREE.Color( 0x383838 );
        //sceneBranches.background = new THREE.Color( 0x000000 );
    }

    function initStats() {
        stats = new Stats();
        stats.setMode( 0 ); // 0: fps, 1: ms
        // Align top-left
        stats.domElement.style.position = 'absolute';
        stats.domElement.style.left = '0px';
        stats.domElement.style.top = '0px';
        document.getElementById( "Stats-output" ).appendChild( stats.domElement );
    }

    function initControls() {

        controls = new THREE.OrbitControls( camera, renderer.domElement );

        controls.enableDamping = true;
        controls.dampingFactor = 0.25;
        controls.enableZoom = true;
    }

    function initOctree() {
        //octree = new THREE.Octree( {
        octree = new OctreeParticle( {
            // uncomment below to see the octree ( may kill the fps )

            //scene: scene,

            // when undeferred = true, objects are inserted immediately
            // instead of being deferred until next octree.update() call
            // this may decrease performance as it forces a matrix update

            //undeferred: false, <-- Have no meaning for OctreeParticle

            // set the max depth of tree
            depthMax: Infinity,
            // max number of objects before nodes split or merge
            objectsThreshold: 10,
            // percent between 0 and 1 that nodes will overlap each other
            // helps insert objects that lie over more than one node
            overlapPct: 0.15
        } );
    }

    function pickElement( v2event ) {

        var mouse = new THREE.Vector2();
        var raycaster = new THREE.Raycaster();

        mouse.x = ( ( v2event.x - renderer.context.canvas.offsetLeft ) / window.innerWidth ) * 2 - 1;
        mouse.y = - ( ( v2event.y - renderer.context.canvas.offsetTop ) / window.innerHeight ) * 2 + 1;

        raycaster.setFromCamera( mouse, camera );

        var octreeObjects = octree.search(
            raycaster.ray.origin,
            raycaster.ray.far,
            false/*false to get geometry info*/,
            raycaster.ray.direction );

        var boundingSphere = new THREE.Sphere();
        var selectedNode = null;

        $.each( octreeObjects, function( key, val ) {

            boundingSphere.center = val.position;
            boundingSphere.radius = val.radius;

            var pt = raycaster.ray.intersectSphere( boundingSphere );
            if ( pt ) {

                var id = val.object;
                var node = Nodes[id];
                node.dist = pt.distanceToSquared( camera.position );

                if ( !node.visible )
                    return;

                selectedNode = selectedNode && selectedNode.dist < node.dist ? selectedNode : node;
            }
        } );

        selectedNode && ( console.log( selectedNode ) || addLabel ( selectedNode ) );
        //showLinked( selectedNode );
    }

    function onMouseDblClick( event ) {

        //showLinked();//hide highlighted elements
        event.preventDefault();

        pickElement( new THREE.Vector2( event.clientX, event.clientY ) );
    }

    function onMouseClick( event ) {


    }

    function init() {

        initGL();
        initMaterials();
        initStats();
        initControls();
        initOctree();
    }

    function draw() {

        update();
        requestAnimationFrame( draw );

        renderer.render( scene, camera );
    }

    const NodeShader = {

        uniforms: {

            "vpSizeY":  { type: "f", value: 1.0 },
            "opacity":  { type: "f", value: 1.0 },
            //"color": { type: "v3", value: null}


            //"tex": { type: "t", value: THREE.ImageUtils.loadTexture( "2.png" ) }
        },

        vertexShader: [

            "uniform float vpSizeY;",

            "attribute float customSize;",
            "attribute float customBrightness;",
            "attribute vec3 customColor;",

            "varying float brightness;",
            "varying vec3 color;",


            "void main() {",

            "vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
            "gl_Position = projectionMatrix * mvPosition;",

            //http://stackoverflow.com/questions/25780145/gl-pointsize-corresponding-to-world-space-size
            "gl_PointSize = vpSizeY * projectionMatrix[1][1] * customSize / gl_Position.w;",
            "brightness = customBrightness;",
            "color = customColor;",
            "}"

        ].join( "\n" ),

        fragmentShader: [

            "uniform float opacity;",
            //"uniform vec3 color;",

            "varying float brightness;",
            "varying vec3 color;",

            "void main() {",

            "gl_FragColor = vec4( color * brightness, opacity );",
            "}"

        ].join( "\n" )

    };

    function initMaterials() {

        var canvasSize = new THREE.Vector2( renderer.context.canvas.width, renderer.context.canvas.height );

        var nodeMaterial = new THREE.ShaderMaterial( NodeShader );
        nodeMaterial.uniforms.vpSizeY.value = canvasSize.y;
        //nodeMaterial.uniforms.color.value = new THREE.Color( 0.15, 0.25, 0.15 );//new THREE.Color( 0.5, 0.7, 0.4 );
        nodeMaterial.uniforms.opacity.value = SceneElementOpacity;
        nodeMaterial.transparent = true;
        nodeMaterial.depthWrite = false;
        nodeMaterial.blending = THREE.AdditiveBlending;

        var nodeShowMaterial = nodeMaterial.clone();
        //nodeShowMaterial.uniforms.opacity.value = 0.25;
        //nodeShowMaterial.uniforms.color.value = new THREE.Color( 0.6, 1.0, 0.6 );
        nodeShowMaterial.uniforms.opacity.value = 0.5;
        //nodeShowMaterial.uniforms.color.value = new THREE.Color( 1.0, 1.0, 1.0 );

        var branchMaterial = new THREE.MeshLineMaterial( {

            useMap: false,
            color: new THREE.Color( 0.15, 0.25, 0.15 ),
            transparent:true,
            opacity: SceneElementOpacity,
            resolution: canvasSize,
            sizeAttenuation: true,
            //lineWidth: worldSize * 0.2,//see size changes function
            near: camera.near,
            far: camera.far,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        } );

        var branchShowMaterial = branchMaterial.clone();
        branchShowMaterial.uniforms.color.value = new THREE.Color( 0.6, 1.0, 0.6 );
        branchShowMaterial.blending.value = THREE.AdditiveBlending;

        var labelSpriteMaterial = new THREE.SpriteMaterial( {

            blending: THREE.NormalBlending,
            depthWrite: false
        } );

        Materials = {

            "node": nodeMaterial,
            "nodeShow": nodeShowMaterial,
            "branch": branchMaterial,
            "branchShow": branchShowMaterial,
            "label": labelSpriteMaterial
        }
    }

    return {

        constructInstance: function constructInstance () {
            if ( instance ) {
                return instance;
            }
            if ( this && this.constructor === constructInstance ) {
                instance = this;
            } else {
                return new constructInstance();
            }
        },

        init: function() {

            init();
            draw();
        },

        loadNode: function( node ) {

            loadNode( node );//-->Nodes
        },

        loadBranch: function( branch ) {

            loadBranch( branch )//-->Branches
        },

        draw: function( ) {

            scene.remove( NodesMesh );
            scene.remove( BranchesMesh );

            updateMetrics();
            setNodesPositions();

            NodesMesh = addParticles( Materials.node );
            BranchesMesh = addLines( Materials.branch );
        }
    }

}() );

