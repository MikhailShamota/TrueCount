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

            //id: value2id(target["this@source"]),
            id: target["this@source"],
            weight: 1
        };
        i++;
    });

    return targets;
}

///используется из-за возможного
function value2id(str) {

    return str && str.toUpperCase();
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
            id: value2id(target.key)
            //,            weight: target.doc_count
        };
        i++;
    });

    return targets;
}

function getData(body) {

    var elasticURL = 'http://elastic.axapta.local:80';
    var xhr = new XMLHttpRequest();
    var path = elasticURL + '/ks4/graph/_search?scroll=3m';
    var stringBody = JSON.stringify(body);

    xhr.open('post', path, false);
    xhr.onload = startScrolling;
    //Отсылаем запрос, в параметрах body: string
    xhr.send(stringBody)

    var result;
    var scroll_id;

    function startScrolling(e) {

        if (xhr.readyState === 4) {

            if (xhr.status === 200) {

                //Получили первую страницу результатов
                result = JSON.parse(xhr.response);
                //составляем новый запрос
                scroll_id = result._scroll_id;
                stringBody = JSON.stringify({

                    "scroll": "1m",
                    "scroll_id": scroll_id
                });

                xhr.open('post', elasticURL + '/_search/scroll');
                xhr.onload = continueScrolling;
                xhr.send(stringBody);
                console.log(result.hits.hits.length);
            } else {

                console.error(xhr.statusText);
            }
        }
    };

    function continueScrolling(e) {

        if (xhr.readyState === 4) {

            if (xhr.status === 200) {

                var objResponse = JSON.parse(xhr.response);
                if (objResponse.hits.hits.length !== 0) {

                    result.hits.hits = result.hits.hits.concat(objResponse.hits.hits)
                    xhr.open('post', elasticURL + '/_search/scroll');
                    xhr.send(stringBody);
                    console.log(result.hits.hits.length + " hits loaded");
                } else {

                    runData(result);
                }
            } else {

                console.error(xhr.statusText);
            }
        }
    }

}

function runData(json) {

    var topagg = [json["aggregations"] && json["aggregations"]["agg_my"]];
    var hits = json["hits"].hits;
    var agg = json["aggregations"] && json["aggregations"]["agg_my"] && json["aggregations"]["agg_my"].buckets;

    topagg && TrueCount.loadNodes(topagg,    getFieldFunction(null),       getFieldFunction(null),               getFieldFunction("buckets"));
    agg && TrueCount.loadNodes(agg,       getFieldFunction("key"),      getFieldFunction(null),               getFieldFunction("doc_count"),                  getAggBucketsTargets);
    hits && TrueCount.loadNodes(hits,      getFieldFunction("_id"),      getFieldFunction("this@tablename"),   getFieldFunction(null),   getHitsTargets);

    TrueCount.drawNodes();
    TrueCount.drawLinks();
}
