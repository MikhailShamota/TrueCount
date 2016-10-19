/**
 * Created by mshamota on 05.10.2016.
 */
var stats, controls;
var camera, scene, renderer;
var octree;
var gravityCenters = {};
var worldRadius = 500;//размер области отрисовки
var defaultParticleSize = 2;

init();
paintGL();

function setPartice(num, positions, sizes, obj, size, gravity) {

    if (!gravity)
        throw new Error("no gravity found");

    var vertex = getRandPosOnSphere(gravity.position, gravity.radius);

    vertex.toArray(positions, num * 3);

    sizes[num] = size;

    var node = {
        vertex: vertex,
        radius: size,
        gravityId: gravity.id
    };

    octree.addDeferred(obj, "_id", node);
}

function addParticles(positions, sizes) {

    //var textureLoader = new THREE.TextureLoader();
    //var tex = textureLoader.load("2.png");//THREE.ImageUtils.loadTexture("1.jpg"),

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

function setGravity(obj, gravitySourceField) {

    var gravityId = obj["_source"][gravitySourceField]|| THREE.Math.generateUUID();
    var gravity = gravityCenters[gravityId];
    if (!gravity) {

        //TODO:распределять их так, чтобы не пересекались (касались?)
        var center = getRandPosInSphere(v3Zero, worldRadius);

        gravity = {position: center, radius: 0, count:0, id:gravityId, field:gravitySourceField};

        gravityCenters[gravityId] = gravity;
    }
    gravity.count++;
    gravity.radius = Math.sqrt(gravity.count * defaultParticleSize) * 2;

    return gravity;
}

function parseElements(iterator, weightProperty, gravitySourceField) {

    if (!iterator)
        return;

    var count = iterator.length || 0;
    var sizes = new Float32Array(count);
    var positions = new Float32Array(count * 3);

    var size;
    var weight;//default
    var sizeScale;

    var i = 0;

    $.each(iterator, function (key, val) {

        var gravity = setGravity(val, gravitySourceField);

        weight = (weightProperty && val[weightProperty]) || 1;//вес точки
        sizeScale = i == 0 ? defaultParticleSize / weight : sizeScale;//i==0 первое значение в выборке самое большое
        size = weight * sizeScale;

        setPartice(i, positions, sizes, val, size, gravity);

        i++;
    });

    addParticles(positions,sizes);
}

function buildParticles() {

    $.getJSON("ElasticData/response-export-102.json", {async:false,cache:false},function (json) {

        var hits = json["hits"].hits;
        var agg = json["aggregations"] && json["aggregations"]["agg_my"] && json["aggregations"]["agg_my"].buckets;

        parseElements(hits, null, "this@tablename");
        parseElements(agg, "doc_count", null);

        buildBranches();
    });
}

function addLine(from, to, branchesObj) {

    var v1 = from.position;
    var v2 = to.position;

    var g1 = gravityCenters[from.gravityId];
    var g2 = gravityCenters[to.gravityId];
    var from_to = g2.position.clone().sub(g1.position);

    var v3 = from_to.multiplyScalar(0.5).add(g1.position);//срединная точка между центрами гравитации

    var canvasSize = new THREE.Vector2(renderer.context.canvas.width, renderer.context.canvas.height);

    var material = new THREE.MeshLineMaterial( {
        useMap: false,
        color: new THREE.Color(0,1,0),
        transparent:true,
        opacity: 0.3,
        resolution: canvasSize,
        sizeAttenuation: true,
        lineWidth: 3,
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

    branchesObj.add(mesh);
}

function buildBranches() {

    var branches = new THREE.Object3D();

    $.each(octree.objects, function(objIndex, obj) {

        obj._source["this@targets"] && $.each(obj._source["this@targets"], function(key, target) {

            //objIndex - индекс объекта octree, которые перебираем
            //key - название FK
            //obj - объект ElasticSearch - тот, кто ссылается
            var nodeFrom = octree.objectsData[objIndex];//кто ссылается, включая данные о координатах

            var index_to = octree.objectsMap[target];//ищем номер объекта на который ссылаемся

            if (!index_to)
                return;

            var nodeTo = octree.objectsData[index_to];//объект, на который ссылаются, включая координаты octree
            //to.object - объект ElasticSearch

            addLine(nodeFrom, nodeTo, branches);
        });
    });

    scene.add(branches);
}

function update() {

    controls.update(); // required if controls.enableDamping = true, or if controls.autoRotate = true
    stats.update();
}

function initializeGL() {

    scene = new THREE.Scene();
    var WIDTH = window.innerWidth, HEIGHT = window.innerHeight;

    camera = new THREE.PerspectiveCamera(75, window.width / window.height, 0.1, 10000);
    camera.position.z = 750;
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

    scene.background = new THREE.Color(0x101010);
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
    buildParticles();
}

function paintGL() {
    update();
    requestAnimationFrame(paintGL);
    renderer.render(scene, camera);
}