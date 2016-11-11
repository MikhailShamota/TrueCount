/**
 * Created by mshamota on 05.10.2016.
 */


init();
paintGL();




getData(
    //data.query.match[groupBy] = "GM_Dispatch OR GM_DispatchClient OR GM_WayBill OR GM_DispatchAddService";

        //TODO:шаблоны запросов https://www.elastic.co/guide/en/elasticsearch/reference/current/search-template.html

    {
        "_source":["this@properties.this@tablename","this@targets"],
        "size": 0,
        "aggs": {
            "agg_my": {
                "terms": {"field": "this@properties.this@tablename.keyword", "size": 1000},
                "aggs": {
                    "agg2": {

                        "nested": {"path":"this@targets"},

                        "aggs": {
                            "agg3": {"terms":{"field": "this@targets.this@tablename.keyword"}
                            }
                        }

                    }
                }
            }
        }
    }

/*
     {
     "_source":["this@properties.this@tablename","this@targets","this@properties.GM_DISPATCH->totalamount"],
     "size": 1000,
     "query": {
     "match": {"this@properties.this@tablename": "GM_Dispatch OR GM_DispatchClient OR GM_DispatchAddService OR GM_WayBill"}
     },
     "sort": {
     "this@properties.GM_DISPATCH->totalamount" : "desc"
     },
     "aggs": {
     "agg_my": {
     "terms": {"field": "this@properties.this@tablename.keyword", "size": 1000},
     "aggs": {
     "agg2": {

     "nested": {"path":"this@targets"},

     "aggs": {
     "agg3": {"terms":{"field": "this@targets.this@tablename.keyword"}
     }
     }

     }
     }
     }
     }
     }

*/

);
