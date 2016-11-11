/**
 * Created by mshamota on 11.11.2016.
 */
function getFieldFunction(field) {

    return (
        function (obj) {

            //var value = value2id(getFieldValue(obj, field));
            var value = field && (obj[field] || obj["_source"][field] || obj["_source"]["this@properties"][field]);
            return value && value.isArray && value.length || value || '';
        });
}

/*function getFieldValue(obj, field) {

    return field && (obj[field] || obj["_source"][field] || obj["_source"]["this@properties"][field]);
}*/

function getHitsTargets(obj) {

    if (!obj || !obj._source || !obj._source["this@targets"])
        return null;

    var docs = obj._source["this@targets"];

    if (docs.length == 0)
        return;

    var targets = new Array(docs.length);
    var i = 0;

    $.each(docs, function(key, target) {

        targets[i] = {
            id: value2id(target["this@source"]),
            weight: 1
        };
        i++;
    });

    return targets;
}

function getAggBucketsTargets(obj) {

    if (!obj || !obj.agg2 || !obj.agg2.agg3 || !obj.agg2.agg3["buckets"])
        return null;

    var buckets = obj.agg2.agg3["buckets"];

    if (buckets.length == 0)
        return;

    var targets = new Array(buckets.length);
    var i = 0;

    $.each(buckets, function(key, target) {

        targets[i] = {
            id: value2id(target.key),
            weight: weight2size(target.doc_count)
        };
        i++;
    });

    return targets;
}

function getData(payload) {

    var socket = io("http://172.20.0.121:3228");

    socket.emit("set_url", { url: "http://elastic.axapta.local:80/", path: "ks4/graph/_search" });

    //connect событие при подключении
    socket.on("connect", function() {
        //get_graph событие для сервера и объект-запрос к эластику
        socket.emit("get_graph", payload);

        socket.on("graph", function(json) {

            var topagg = [json["aggregations"] && json["aggregations"]["agg_my"]];
            var hits = json["hits"].hits;
            var agg = json["aggregations"] && json["aggregations"]["agg_my"] && json["aggregations"]["agg_my"].buckets;

            doSelect(topagg,    getFieldFunction(null),       getFieldFunction(null),               getFieldFunction("buckets"));
            doSelect(agg,       getFieldFunction("key"),      getFieldFunction(null),               getFieldFunction("doc_count"),                  getAggBucketsTargets);
            doSelect(hits,      getFieldFunction("_id"),      getFieldFunction("this@tablename"),   getFieldFunction("GM_DISPATCH->totalamount"),   getHitsTargets);

            addLinks();
        });

    });
}