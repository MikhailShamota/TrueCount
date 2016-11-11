/**
 * Created by mshamota on 11.11.2016.
 */
const v3Zero = new THREE.Vector3(0, 0, 0);
const v3UnitX = new THREE.Vector3(1, 0, 0);
const v3UnitY = new THREE.Vector3(0, 1, 0);
const v3UnitZ = new THREE.Vector3(0, 0, 1);

var stats, controls;
var camera, scene, renderer;
var octree;


var worldSize = 1000;
var defaultDensity = 0.4;
var Links;
var Nodes = {};

function getRandomUnitVector() {

    var a = new THREE.Euler(
        Math.random() * 2 * Math.PI,
        Math.random() * 2 * Math.PI,
        Math.random() * 2 * Math.PI,
        'XYZ'
    );

    return v3UnitX.clone().applyEuler(a);
}

function getRandPosInSphere(center, radius) {

    return getRandomUnitVector().multiplyScalar(Math.random() * radius).add(center);
}

function getRandPosOnSphere(center, radius) {

    return getRandomUnitVector().multiplyScalar(radius).add(center);
}

function addParticles(positions, sizes) {

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
///используется из-за возможного
function value2id(str) {

    return str && str.toUpperCase();
}

function weight2size(weight) {

    return weight && Math.cbrt(weight) || 1;// * defaultDocumentSize / defaultDocumentDensity;
}

function doSelect(iterator, fGetId, fGetParentId, fGetWeight, fGetTargets) {

    if (!iterator)
        return;

    var count = iterator.length || 0;
    var sizes = new Float32Array(count);
    var positions = new Float32Array(count * 3);

    var i = 0;
    var sceneNextId = scene.children.length;

    $.each(iterator, function (key, val) {

        var weight = fGetWeight(val);
        var id = value2id(fGetId(val));

        if (Nodes[id])
            return;//TODO:может быть обновлять объект при повторной загрузке? Пока считаем, что повторное считывание не более чем повторное считывание


        var parentId = fGetParentId(val) || '';
        var parent = Nodes[parentId];


        var size = parent && parent.childSize || worldSize;//размер для элементов внутри parent
        var sizeWeighted = weight2size(weight) ;//размер на основании веса объекта
        //var sizeWeighted = weight && weight2size(weight.length || weight) || 1;//размер на основании веса объекта

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
            children: {},
            visible: true,
            position: getRandPosOnSphere(parent && parent.position || v3Zero, parent && parent.size || 0),
            document: val,
            targets: fGetTargets && fGetTargets(val)
        };

        obj.position.toArray(positions, obj.index * 3);
        sizes[obj.index] = obj.size;

        if (parent) {

            parent.visible && hideElement(parent);
            parent.visible = false;
            parent.children[obj.id] = obj;
        }

        //octree.addDeferred(obj);-->
        octree.addObjectData(obj.id, obj);//<--overrided

        Nodes[id] = obj;

        i++;

    });

    addParticles(positions, sizes);

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

function branch(from, to) {

    var v1 = from.position;
    var v2 = to.position;

    var s1 = from.size;
    var s2 = to.size;

    var v3 = v3Zero.clone();
    if (from.parent.id == to.parent.id)

        v3 = from.parent.position.clone();
    else {

        var g1 = from.parent.parent || from.parent;
        var g2 = to.parent.parent || to.parent;
        var from_to = g2.position.clone().sub(g1.position);

        v3 = from_to.multiplyScalar(0.5).add(g1.position);//срединная точка между центрами гравитации
    }

    var canvasSize = new THREE.Vector2(renderer.context.canvas.width, renderer.context.canvas.height);

    var material = new THREE.MeshLineMaterial( {
        useMap: false,
        color: new THREE.Color(0.15,0.4,0.15),
        transparent:true,
        opacity: 0.15,
        resolution: canvasSize,
        sizeAttenuation: true,
        lineWidth: 0.8,//see size changes function bellow
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
    line.setGeometry(

        geometry,
        function(p) {return s2 * p + s1 * (1 - p)}//size changes linear from start to end
    );

    return new THREE.Mesh(line.geometry, material);
}

function addLinks() {

    //полная перестройка узлов
    scene.remove(Links);

    Links = new THREE.Object3D();

    if (!Nodes)
        return;

    $.each(Nodes, function(id, element) {

        var targets = element.targets;

        if (!targets)
            return;

        $.each(targets, function(key, target) {

            var nodeFrom = element;
            var nodeTo = Nodes[target.id];

            if (!nodeFrom || !nodeTo || !nodeFrom.visible || !nodeTo.visible)
                return;

            if (nodeFrom.id == nodeTo.id)
                return;//TODO: явно обрабатывать ссылку узла на себя, пока исключаем, считаем узлы самодостижимыми

            Links.add(branch(nodeFrom, nodeTo));
        });
    });

    scene.add(Links);
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
}

function paintGL() {
    update();
    requestAnimationFrame(paintGL);
    renderer.render(scene, camera);
}