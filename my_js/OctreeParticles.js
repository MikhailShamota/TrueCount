/**
 * Created by mshamota on 13.10.2016.
 */
{
    function OctreeParticle(parameters) {
        THREE.Octree.call(this, parameters);
    }

    OctreeParticle.prototype = Object.create(THREE.Octree.prototype);
    OctreeParticle.prototype.constructor = OctreeParticle;

    OctreeParticle.prototype.addObjectData = function (object, part) {

        var objectData = new THREE.OctreeObjectData(object, part.vertex);
        objectData.radius = part.size;
        objectData.position.copy(part.position);

        // add to tree objects data list
        this.objectsData.push(objectData);

        // add to nodes
        this.root.addObject(objectData);
    }
}