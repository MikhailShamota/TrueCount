/**
 * Created by mshamota on 05.10.2016.
 */
var stats, controls;
var camera, scene, renderer;
var octree;


var worldSize = 1000;
var defaultDensity = 0.4;


var root = {};
var groups = {};
var documents = {};
var links;

init();
paintGL();


function drawParticles(positions, sizes) {

    //var textureLoader = new THREE.TextureLoader();
    //var tex = textureLoader.load("2.png");//THREE.ImageUtils.loadTexture("1.jpg"),
    if (!positions || !sizes)
        return;

    var vShader = $("#NodeVertexShader");
    var fShader = $("#NodeFragmentShader");

    var particleMaterial = new THREE.ShaderMaterial({

        uniforms: {
            //projectionMat: {value: renderer.projectionMatrix}
            vpSizeY: {value: renderer.context.canvas.height},
            //scale: { value: sizeScale }
            //color:     { value: new THREE.Color( 0xffffff ) },
            //texture:   { value: new THREE.TextureLoader().load( "textures/sprites/spark1.png" ) }
        },
        vertexShader:   vShader.text(),
        fragmentShader: fShader.text(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    var geometry = new THREE.BufferGeometry();
    geometry.addAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.addAttribute("customSize", new THREE.BufferAttribute(sizes, 1));

    var particles = new THREE.Points(geometry, particleMaterial);

    scene.add(particles);
}

function getFieldValue(obj, field) {

    return field && (obj[field] || obj["_source"][field]);
}

///используется из-за возможного
function value2id(str) {

    return str && str.toUpperCase();
}

function weight2size(weight) {

    return Math.cbrt(weight);// * defaultDocumentSize / defaultDocumentDensity;
}

function doSelect(iterator, fieldId, fieldParentId, fieldWeight, into, parents) {

    if (!iterator)
        return;

    var count = iterator.length || 0;
    var sizes = new Float32Array(count);
    var positions = new Float32Array(count * 3);

    //var into = {};

    /*
    var center = getAnySpherePosNearby(gravityCentersCenter, gravityCentersRadius, r);
    gravityCentersRadius = r + gravityCentersRadius + (gravityCentersSpacing * r);//(R+r) + (delta * r)
    gravityCentersCenter = center.clone().sub(gravityCentersCenter).normalize().multiplyScalar(r);
    }
    */

    var i = 0;
    var sceneNextId = scene.children.length;

    $.each(iterator, function (key, val) {

        var weight = getFieldValue(val, fieldWeight);
        var id = value2id(getFieldValue(val, fieldId)) || '';

        if (into && into[id])
            return;

        var parent;

        if (parents) {

            var parentId = value2id(getFieldValue(val, fieldParentId)) || '';
            parent = parents[parentId];

            if (!parent)
                throw new Error("No parent found");

            parent.visible && hideElement(parent);
            parent.visible = false;
            //parent.childrenCount++;
        }

        var size = parent && parent.childSize || worldSize;//размер для элементов внутри parent

        var sizeWeighted = weight && weight2size(weight.length || weight) || 1;//размер на основании веса объекта

        if (parent && !parent.sizeScale)
            parent.sizeScale = size / sizeWeighted;//первое значение в выборке самое большое. масштаб всех элементов группировки

        size = sizeWeighted * (parent && parent.sizeScale || size / sizeWeighted);//итоговый размер - размер нормализованный по самому больщому элементу (i=0)

        var obj = {

            id: id,
            index: i,//индекс, порядковый номер элемента внутри геометрии
            sceneIndex: sceneNextId,//индекс, под которым будет в scene.children
            parent: parent,
            size: size,
            childSize: defaultDensity * size / sizeWeighted,//размер для элементов внутри
            //childrenCount: 0,
            visible: true,
            position: getRandPosOnSphere(parent && parent.position || v3Zero, parent && parent.size || 0),
            document: val
        };

        obj.position.toArray(positions, obj.index * 3);
        sizes[obj.index] = obj.size;

        //octree.addDeferred(obj);-->
        octree.addObjectData(obj.id, obj);//<--overrided

        into[id] = obj;

        i++;

    });

    drawParticles(positions, sizes);

    console.log(i + " objects affected")
}

function hideElement(obj) {

    if (!obj || !obj.visible)
        return;

    var geometry = scene.children[obj.sceneIndex].geometry;
    var attribute = geometry.attributes["customSize"];
    attribute.array[obj.index] = 0;
    attribute.needsUpdate = true;
}

function initData(payload) {

    var socket = io("http://172.20.0.121:3228");

    //connect событие при подключении
    socket.on("connect", function() {
        //get_graph событие для сервера и объект-запрос к эластику
        socket.emit("get_graph", payload);

        socket.on("graph", function(json) {

            var topagg = json["aggregations"] && json["aggregations"]["agg_my"];
            var hits = json["hits"].hits;
            var agg = json["aggregations"] && json["aggregations"]["agg_my"] && json["aggregations"]["agg_my"].buckets;

            doSelect([topagg],  null,       null,               "buckets",                  root, null);
            doSelect(agg,       "key",      null,               "doc_count",                groups, root);
            doSelect(hits,      "_id",      "this@tablename",   "GM_DISPATCH->totalamount", documents, groups);


            doLink(documents, groups);
        });

    });
}

function drawLine(from, to, parents) {

    if (!from || !to)
        return;

    var v1 = from.position;
    var v2 = to.position;

    var g1 = from.parent;//parents[from.parentId];
    var g2 = to.parent;//parents[to.parentId];
    var from_to = g2.position.clone().sub(g1.position);

    var v3 = from_to.multiplyScalar(0.5).add(g1.position);//срединная точка между центрами гравитации

    var canvasSize = new THREE.Vector2(renderer.context.canvas.width, renderer.context.canvas.height);

    var material = new THREE.MeshLineMaterial( {
        useMap: false,
        color: new THREE.Color(0.1,0.4,0.1),
        transparent:true,
        opacity: 0.1,
        resolution: canvasSize,
        sizeAttenuation: true,
        lineWidth: 1.8,
        near: camera.near,
        far: camera.far,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });

    var curve = new THREE.QuadraticBezierCurve3 (v1, v3, v2);
    var geometry = new THREE.Geometry();
    geometry.vertices = curve.getPoints(20);

    //geometry.vertices.push(v1, v2);//straight line

    var line = new THREE.MeshLine();
    line.setGeometry(geometry);

    var mesh = new THREE.Mesh(line.geometry, material);

    links.add(mesh);

    /*var material2 = new THREE.LineBasicMaterial({
        color: 0x0000ff
    });
    var geometry2 = new THREE.Geometry();
    geometry2.vertices.push(v1, v2);
    var line2 = new THREE.Line( geometry2, material2 );
    scene.add(line2)*/
}

function doLink(elements, parents) {

    //полная перестройка узлов
    scene.remove(links);
    links = new THREE.Object3D();

    if (!elements)
        return;

    //var branches = new THREE.Object3D();

    $.each(elements, function(id, element) {

        var doc = element.document;

        if (!doc || !doc._source || !doc._source["this@targets"])
            return;

        $.each(doc._source["this@targets"], function(key, target) {

            var nodeFrom = element;
            var nodeTo = elements[value2id(target)];

            drawLine(nodeFrom, nodeTo, parents);
        });
    });

    scene.add(links);
}

function update() {

    controls.update(); // required if controls.enableDamping = true, or if controls.autoRotate = true
    stats.update();
}

function initializeGL() {

    scene = new THREE.Scene();
    var WIDTH = window.innerWidth, HEIGHT = window.innerHeight;

    camera = new THREE.PerspectiveCamera(75, window.width / window.height, 0.1, 1000000);
    camera.position.z = 3750;
    camera.aspect = WIDTH / HEIGHT;
    camera.updateProjectionMatrix();

    window.addEventListener('resize', function() {
        var WIDTH = window.innerWidth, HEIGHT = window.innerHeight;

        renderer.setSize(WIDTH, HEIGHT);
        camera.aspect = WIDTH / HEIGHT;
        camera.updateProjectionMatrix();
    });

    renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(WIDTH, HEIGHT);
    renderer.sortObjects = false;
    renderer.domElement.addEventListener("click", onMouseClick);

    document.body.appendChild(renderer.domElement);

    scene.background = new THREE.Color(0x181818);
}
/*
 function resizeGL(canvas) {
 camera.aspect = canvas.width / canvas.height;
 camera.updateProjectionMatrix();

 renderer.setPixelRatio(canvas.devicePixelRatio);
 renderer.setSize(canvas.width, canvas.height);
 }
 */

function initStats() {
    stats = new Stats();
    stats.setMode(0); // 0: fps, 1: ms
    // Align top-left
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.left = '0px';
    stats.domElement.style.top = '0px';
    document.getElementById("Stats-output").appendChild(stats.domElement);
}

function initControls() {
    controls = new THREE.OrbitControls( camera, renderer.domElement );
    //controls.addEventListener( 'change', render ); // add this only if there is no animation loop (requestAnimationFrame)
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;
    controls.enableZoom = true;
}

function initOctree() {
    //octree = new THREE.Octree( {
    octree = new OctreeParticle( {
        // uncomment below to see the octree (may kill the fps)

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

function onMouseClick(event) {

    var mouse = new THREE.Vector2();
    var raycaster = new THREE.Raycaster();

    event.preventDefault();

    mouse.x = ( (event.clientX - renderer.context.canvas.offsetLeft) / window.innerWidth ) * 2 - 1;
    mouse.y = - ( (event.clientY - renderer.context.canvas.offsetTop) / window.innerHeight ) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    //var right = new THREE.Vector3(camera.matrix.elements[0], camera.matrix.elements[1], camera.matrix.elements[2]).normalize();
    //var up = new THREE.Vector3(camera.matrix.elements[4], camera.matrix.elements[5], camera.matrix.elements[6]).normalize();
    //var backward = new THREE.Vector3(camera.matrix.elements[8], camera.matrix.elements[9], camera.matrix.elements[10]).normalize();

    var octreeObjects = octree.search(
        raycaster.ray.origin,
        raycaster.ray.far,
        false/*false to get geometry info*/,
        raycaster.ray.direction);

    var boundingSphere = new THREE.Sphere();
    $.each(octreeObjects, function(key, val) {

        //TODO:into particlenode class
        //TODO:sort by dist
        //var x = right.clone().multiplyScalar(val.radius);
        //var y = up.clone().multiplyScalar(val.radius);
        //boundingSphere.center = (x).sub(y).add(val.position);
        boundingSphere.center = val.position;
        boundingSphere.radius = val.radius;
        if (raycaster.ray.intersectSphere(boundingSphere)) {
            //var mesh = new THREE.Mesh(new THREE.SphereGeometry(val.radius,10,10),new THREE.MeshBasicMaterial({color:0xffffffff}));
            //mesh.position.set(boundingSphere.center.x,boundingSphere.center.y,boundingSphere.center.z);
            //scene.add(mesh);
            console.log(val.object);
        }
    });
}

function init() {
    initializeGL();
    initStats();
    initControls();
    initOctree();

    initData(
        //data.query.match[groupBy] = "GM_Dispatch OR GM_DispatchClient OR GM_WayBill OR GM_DispatchAddService";

            //TODO:шаблоны запросов https://www.elastic.co/guide/en/elasticsearch/reference/current/search-template.html
            {
                "_source":["this@tablename","this@targets","GM_DISPATCH->totalamount"],
                "size": 1000,
                "query": {
                    "match": {"this@tablename": "GM_Dispatch OR GM_DispatchClient OR GM_DispatchAddService OR GM_WayBill"}
                },
                "sort": {
                    "GM_DISPATCH->totalamount" : "desc"
                },
                "aggs": {
                    "agg_my": {
                        "terms": {"field": "this@tablename", "size": 1000}
                    }
                }
            }


    );
}

function paintGL() {
    update();
    requestAnimationFrame(paintGL);
    renderer.render(scene, camera);
}