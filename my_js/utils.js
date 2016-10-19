/**
 * Created by mshamota on 19.10.2016.
 */

var v3Zero = new THREE.Vector3(0, 0, 0);
var v3UnitX = new THREE.Vector3(1, 0, 0);
var v3UnitY = new THREE.Vector3(0, 1, 0);
var v3UnitZ = new THREE.Vector3(0, 0, 1);

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

function getAnySpherePosNearby(existSphereCenter, existSphereRadius, newSphereRadius) {

    return getRandPosOnSphere(existSphereCenter, existSphereRadius + newSphereRadius);
}