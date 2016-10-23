/**
 * Created by mshamota on 13.10.2016.
 */
{
    function OctreeParticle(parameters) {
        THREE.Octree.call(this, parameters);
    }

    OctreeParticle.prototype = Object.create(THREE.Octree.prototype);
    OctreeParticle.prototype.constructor = OctreeParticle;

    OctreeParticle.prototype.addDeferred = function (data, idProperty, node) {

        var id = data[idProperty];
        if (!id || !this.objectsMap[id]) {

            this.objects.push(data);

            this.addObjectData(data, node);//<--

            //this.objectsMap[id] = data;
            this.objectsMap[id] = this.objectsData.length - 1;//saving index of element
        }

        //this.addObjectData(data, node);//-->
    };

    OctreeParticle.prototype.addObjectData = function (object, part) {

        var objectData = new THREE.OctreeObjectData(object, part.vertex);
        objectData.radius = part.radius;
        objectData.position.copy(objectData.vertices);
        objectData.gravityId = part.gravityId;

        // add to tree objects data list
        this.objectsData.push(objectData);

        // add to nodes
        this.root.addObject(objectData);
    }
}