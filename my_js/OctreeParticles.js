/**
 * Created by mshamota on 13.10.2016.
 */
{
    function OctreeParticle(parameters) {
        THREE.Octree.call(this, parameters);
    }

    OctreeParticle.prototype = Object.create(THREE.Octree.prototype);
    OctreeParticle.prototype.constructor = OctreeParticle;

    OctreeParticle.prototype.addObjectData = function ( id, part ) {

        var objectData = this.objectsMap[id] ? this.objectsMap[id] : new THREE.OctreeObjectData( id, part.vertex );
        objectData.radius = part.size;
        objectData.position.copy(part.position);

        //if already in octree
        if ( this.objectsMap[id] ) {

            var node = objectData.node;

            if ( node instanceof THREE.OctreeNode && ! objectData.positionLast.equals( objectData.position ) ) {

                // get octant index of object within current node
                var indexOctantLast = objectData.indexOctant;
                var indexOctant = node.getOctantIndex( objectData );

                // if object octant index has changed
                if ( indexOctant !== indexOctantLast ) {

                    // remove object from current node
                    objectData.node.removeObject( objectData );

                    // add object to tree root
                    this.root.addObject( objectData );
                }

            }

            return;
        }

        // add to tree objects data list
        this.objectsData.push( objectData );

        // add to nodes
        this.root.addObject( objectData );

        this.objectsMap[id] = objectData;
    }


}