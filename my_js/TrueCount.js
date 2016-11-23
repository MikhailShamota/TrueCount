/**
 * Created by mshamota on 11.11.2016.
 */
var TrueCount = (function () {

    var instance;


    const v3Zero = new THREE.Vector3(0, 0, 0);
    const v3UnitX = new THREE.Vector3(1, 0, 0);
    const v3UnitY = new THREE.Vector3(0, 1, 0);
    const v3UnitZ = new THREE.Vector3(0, 0, 1);

    const worldSize = 1000;
    const defaultDensity = 0.2;

    const SceneElementOpacity = 0.15;
    const SceneElementFadeOpacity = 0.05;

    var stats, controls;
    var camera, scene, renderer;
    var octree;

    var BranchesMesh;
    var BranchesMeshShowed;
    var NodesMesh;
    var NodesMeshShowed;

    var Nodes = {};

    var Materials;


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

    function addParticles(nodes, material) {

        if (!nodes)
            return;

        var count = Object.keys(nodes).length || 0;
        var sizes = new Float32Array(count);
        var positions = new Float32Array(count * 3);
        var i = 0;

        $.each(nodes, function (id, node) {

            node.position.toArray(positions, i * 3);
            sizes[i] = node.visible && node.size || 0;

            i++;
        });

        var geometry = new THREE.BufferGeometry();
        geometry.addAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.addAttribute("customSize", new THREE.BufferAttribute(sizes, 1));

        var particles = new THREE.Points(geometry, material);

        scene.add(particles);

        return particles;
    }

    function weight2size(weight) {

        return weight && Math.pow(weight, 1/3) || 1;// * defaultDocumentSize / defaultDocumentDensity;
    }

    function node2hint(node) {

        return node.id;// + ":" + node.weight;
    }

    function label(txt, billboardSize) {

        var canvas = document.createElement("canvas");
        canvas.width = canvas.height = 512;//четкость зависит от

        var context = canvas.getContext("2d");

        var fontSizes = [72, 50, 36, 28, 20, 14, 12, 10, 8, 6, 5, 4, 3, 2],
            textDimensions,
            i = 0;

        do {

            context.font = "Bold " + fontSizes[i++] + 'px Arial Narrow';
            textDimensions = context.measureText(txt);
        } while (textDimensions.width >= canvas.width);


        //context.fillStyle = "rgba(155, 255, 155, 0.28)";
        //context.fillRect(0,0,canvas.width,canvas.height);

        /*
        context.fillStyle = "rgba(78, 240, 129, 1.0)";
        context.lineWidth   = 5;
        context.strokeRect(0,0,canvas.width,canvas.height);


        context.fillStyle = 'green';
        context.fillStyle = "rgba(78, 240, 129, 1.0)";
        context.textAlign = "center";
        context.textBaseline = "middle";

        context.fillText(txt, canvas.width / 2, canvas.height / 2);
        context.fillStyle = 'black';
        context.lineWidth   = 1;
        context.strokeText(txt, canvas.width / 2, canvas.height / 2);
        */

        context.fillStyle = 'black';
        context.textAlign = "center";
        context.textBaseline = "middle";

        //txt = txt.split('').sort(function(){return 0.5-Math.random()}).join('');

        context.fillText(txt, canvas.width / 2, canvas.height / 2);

        var texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;

        var material = Materials.label.clone();
        material.map = texture;

        var sprite = new THREE.Sprite(material);
        sprite.scale.set(billboardSize, billboardSize, 1);

        return sprite;
    }

    function addLabel(node) {

        if (node.label)
            return;

        var sprite = label(node2hint(node), node.size * 2 /*R x 2*/ );
        sprite.position.set(node.position.x, node.position.y, node.position.z);
        scene.add(sprite);
        node.label = true;
    }

    function loadNodes(iterator, fGetId, fGetParentId, fGetWeight, fGetTargets) {

        if (!iterator)
            return;

        /*var count = iterator.length || 0;
        var sizes = new Float32Array(count);
        var positions = new Float32Array(count * 3);*/

        var i = 0;
        //var sceneNextId = scene.children.length;

        $.each(iterator, function (key, val) {

            var weight = fGetWeight(val);
            var id = fGetId(val);

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
                //index: i,//индекс, порядковый номер элемента внутри геометрии
                //sceneIndex: sceneNextId,//индекс, под которым будет в scene.children
                parent: parent,
                size: size,
                weight: weight,
                childSize: defaultDensity * size / sizeWeighted,//размер для элементов внутри
                children: {},
                visible: true,
                label: false,
                position: getRandPosOnSphere(parent && parent.position || v3Zero, parent && parent.size || 0),
                document: val,
                targets: fGetTargets && fGetTargets(val)
            };

            /*obj.position.toArray(positions, obj.index * 3);
            sizes[obj.index] = obj.size;*/

            if (parent) {

                //parent.visible && hideElement(parent);
                parent.visible = false;
                parent.children[obj.id] = obj;
            }

            octree.addObjectData(obj.id, obj);//<--overrided

            Nodes[id] = obj;

            i++;

        });

        //addParticles(positions, sizes);
        //NodesMesh = addParticles(Nodes, Materials.node);

        console.log(i + " objects affected")
    }

    /*
    function hideElement(obj) {

        if (!obj || !obj.visible)
            return;

        var geometry = scene.children[obj.sceneIndex].geometry;
        var attribute = geometry.attributes["customSize"];
        attribute.array[obj.index] = 0;
        attribute.needsUpdate = true;
    }
    */

    function fade(value) {

        var opacity = SceneElementOpacity * (1 - value) + value * SceneElementFadeOpacity;

        Materials.branch.uniforms.opacity.value = opacity;
        Materials.node.uniforms.opacity.value = opacity;
    }

    function branch(from, to, material) {

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

    function addLinks(nodes, material) {

        //полная перестройка узлов
        //scene.remove(mesh);

        if (!nodes)
            return;

        var mesh = new THREE.Mesh();

        //var i = 0;

        $.each(nodes, function(id, element) {

            var targets = element.targets;

            if (!targets)
                return;

            $.each(targets, function(key, target) {

                var nodeFrom = element;
                var nodeTo = nodes[target.id];//search in global

                if (!nodeFrom || !nodeTo || !nodeFrom.visible || !nodeTo.visible)
                    return;

                if (nodeFrom.id == nodeTo.id)
                    return;//TODO: явно обрабатывать ссылку узла на себя, пока исключаем, считаем узлы самодостижимыми

                mesh.add(branch(nodeFrom, nodeTo, material));

                //i++;
            });
        });

        scene.add(mesh);

        return mesh;
    }

    function getLinkedNodes(nodeFrom, pathOfNodes) {

        if (!nodeFrom || pathOfNodes[nodeFrom.id])
            return;//если узел уже найден - исключение закцикливания явного и неявного

        pathOfNodes[nodeFrom.id] = nodeFrom;

        if (!nodeFrom.targets)
            return;//если нет дальнейших шагов

        $.each(nodeFrom.targets, function(key, target) {

            getLinkedNodes(Nodes[target.id], pathOfNodes);
        });
    }

    function showLinked(nodeFrom) {

        var pathOfNodes = {};

        getLinkedNodes(nodeFrom, pathOfNodes);

        scene.remove(BranchesMeshShowed);
        scene.remove(NodesMeshShowed);
        BranchesMeshShowed = addLinks(pathOfNodes, Materials.branchShow);
        NodesMeshShowed = addParticles(pathOfNodes, Materials.nodeShow);

        $.each(pathOfNodes, function(id, node) {

            addLabel(node);
        });

        fade(nodeFrom && 1 || 0);//если не передан начальный узел - восстанавливаем свечение
    }

    function update() {

        controls.update(); // required if controls.enableDamping = true, or if controls.autoRotate = true
        stats.update();
    }

    function initGL() {

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
        renderer.domElement.addEventListener("dblclick", onMouseDblClick);

        document.body.appendChild(renderer.domElement);

        scene.background = new THREE.Color(0x383838);
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

    function onMouseDblClick(event) {

        showLinked();//hide highlighted elements
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
                var id = val.object;
                var node = Nodes[id];

                if (!node.visible)
                    return;

                console.log(Nodes[id].document);

                showLinked(node);
            }
        });

        /*if (found == 0)
            showLinked();*/
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
        requestAnimationFrame(draw);
        renderer.render(scene, camera);
    }

    const NodeShader = {

        uniforms: {

            "vpSizeY":  { type: "f", value: 1.0 },
            "opacity":  { type: "f", value: 1.0 },
            "color": { type: "v3", value: null}
        },

        vertexShader: [

            "uniform float vpSizeY;",
            "attribute float customSize;",

            "void main() {",

            "vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
            "gl_Position = projectionMatrix * mvPosition;",

            //http://stackoverflow.com/questions/25780145/gl-pointsize-corresponding-to-world-space-size
            "gl_PointSize = vpSizeY * projectionMatrix[1][1] * customSize / gl_Position.w;",

            "}"

        ].join("\n"),

        fragmentShader: [

            "uniform float opacity;",
            "uniform vec3 color;",

            "void main() {",

            //"gl_FragColor = vec4( 0.5, 0.7, 0.4, opacity );",
            "gl_FragColor = vec4(color, opacity);",
            "}"

        ].join("\n")

    };

    function initMaterials() {

        var canvasSize = new THREE.Vector2(renderer.context.canvas.width, renderer.context.canvas.height);

        var nodeMaterial = new THREE.ShaderMaterial(NodeShader);
        nodeMaterial.uniforms.vpSizeY.value = canvasSize.y;
        nodeMaterial.uniforms.color.value = new THREE.Color(0.5, 0.7, 0.4);
        nodeMaterial.uniforms.opacity.value = SceneElementOpacity;
        nodeMaterial.transparent = true;
        nodeMaterial.depthWrite = false;
        nodeMaterial.blending = THREE.AdditiveBlending;

        var nodeShowMaterial = nodeMaterial.clone();
        nodeShowMaterial.uniforms.opacity.value = 0.25;
        nodeShowMaterial.uniforms.color.value = new THREE.Color(0.6, 1.0, 0.6);

        var branchMaterial = new THREE.MeshLineMaterial( {

            useMap: false,
            color: new THREE.Color(0.15, 0.25, 0.15),
            transparent:true,
            opacity: SceneElementOpacity,
            resolution: canvasSize,
            sizeAttenuation: true,
            lineWidth: 0.8,//see size changes function bellow
            near: camera.near,
            far: camera.far,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        var branchShowMaterial = branchMaterial.clone();
        branchShowMaterial.uniforms.color.value = new THREE.Color(0.6, 1.0, 0.6);
        branchShowMaterial.blending.value = THREE.NormalBlending;

        var labelSpriteMaterial = new THREE.SpriteMaterial({

            blending: THREE.NormalBlending,
            depthWrite: false
        });

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
            if (instance) {
                return instance;
            }
            if (this && this.constructor === constructInstance) {
                instance = this;
            } else {
                return new constructInstance();
            }
        },

        init: function() {

            init();
        },

        draw: function() {

            draw();
        },

        loadNodes: function(iterator, fGetId, fGetParentId, fGetWeight, fGetTargets) {

            loadNodes(iterator, fGetId, fGetParentId, fGetWeight, fGetTargets);
        },

        drawNodes: function() {

            scene.remove(NodesMesh);
            NodesMesh = addParticles(Nodes, Materials.node);
        },

        drawLinks: function() {

            scene.remove(BranchesMesh);
            BranchesMesh = addLinks(Nodes, Materials.branch);
        }
    }

}());

