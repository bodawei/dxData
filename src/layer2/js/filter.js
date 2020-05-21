/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * Copyright (c) 2014, 2015 by Delphix. All rights reserved.
 */

/*global dx, _, $, Backbone */

'use strict';

dx.namespace('dx.core.data');

/*
 * Defines general purpose filter routines. These can be used to build type-specific filters.
 *
 * A filter is simply a function that reproduces the server's treatment of the query parameters on the list operation
 * for any type.  Each filter function has the signature
 *    filterFunction(collection, model, resultHandler)
 * The filter function should examine the query parameters on the collection, then examine the properties of the model
 * and call resultHandler with a value indicating how the model should be placed with respect to the collection:
 *    INCLUDE: The model can be put in the collection
 *    EXCLUDE: The model should not be put in the collection (and removed if it is there already)
 *    UNKNOWN: The filter can't determine what to do with the model. Most likely the collection should be re-fetched
 * The potentially asynchronous call to resultHandler is necessary since some query parameters will require retrieval
 * of models to make their determination.
 */
(function() {

dx.core.data._initFilters = function(context) {
    var EXCLUDE = 'EXCLUDE';
    var INCLUDE = 'INCLUDE';
    var UNKNOWN = 'UNKNOWN';

    var DATE_PROPS = ['fromDate', 'startDate', 'toDate', 'endDate'];

    /*
     * Helper for non-generated filters. In many cases, the property in the query parameter is the same as that of the
     * attribute in the model. This means we can make a decision synchronously, which keeps the logic in the filters
     * simpler (compare to checkQueryParam(), which returns a promise).
     * This compares the value in the query parameter with that of the model.
     *
     * properties: An array of property names to compare
     * qParams:    The query parameters to compare
     * model:      The model to compare
     */
    function checkSameProps(properties, qParams, model) {
        var result = INCLUDE;

        _.each(properties, function(property) {
            if (_.has(qParams, property) && qParams[property] !== model.get(property)) {
                result = EXCLUDE;
            }
        });

        return result;
    }

    /*
     * When a model is being compared against a collection that has been retrieved with paging, then we can't reliably
     * tell whether the model belongs in the collection. Note that this assumes not specifying a page size implicitly
     * sets it to a particular size (generally 25), while specifying 0 means 'all'
     */
    function checkPageSize(qParams) {
        if (!_.has(qParams, 'pageSize') || qParams.pageSize !== 0) {
            return UNKNOWN;
        }
        return INCLUDE;
    }

    /*
     * Helper function to check date-related query parameters. This assumes qParamName is a valid date property.
     * The caller is responsible for making sure that qParamName is one of DATE_PROPS
     */
    function checkDateProp(qParamVal, qParamName, qpSchema, model, attrName) {
        if (!_.has(qpSchema, 'inequalityType')) {
            dx.fail('Date property "' + qParamName + '" missing "inequalityType" schema property');
        }
        if (dx.core.util.isNone(model.get(attrName))) {
            return EXCLUDE;
        }

        if (_.contains(['fromDate', 'startDate'], qParamName)) {
            if (model.get(attrName).getTime() < qParamVal.getTime()) {
                return EXCLUDE;
            }
        } else if (model.get(attrName).getTime() > qParamVal.getTime()) { // toDate or endDate
            return EXCLUDE;
        }

        if (qpSchema.inequalityType === dx.core.constants.INEQUALITY_TYPES.STRICT &&
                model.get(attrName).getTime() === qParamVal.getTime()) {
            return EXCLUDE;
        }

        return INCLUDE;
    }

    /*
     * Helper for the uberFilter to check an individual query parameter against the model. This may involve
     * asynchronous ServerModel fetches to resolve 'mapsTo' data mapping chains. As a result this returns a promise to
     * the caller. At the moment this only deals with query params that may result in INCLUDE or EXCLUDE - never
     * UNKNOWN.
     * The returned promise is either resolved with INCLUDE or rejected with EXCLUDE.
     */
    function checkQueryParam(qParamVal, qParamName, model, rootSchemaDef) {
        var qpSchema = rootSchemaDef.list.parameters[qParamName],
            deferred = $.Deferred(),
            mapsTo = qpSchema.mapsTo;

        if (!mapsTo) {
            dx.fail('No mapsTo property found for query parameter ' + qParamName + '.');
        }

        var pathSegs = mapsTo.split('.');

        // We know the last seg will be property to compare. Anything before will be a chain of object references.
        var finalAttrName = pathSegs.pop();

        // Recursively walk the data mapping segments
        function followNextSeg(currModel) {
            currModel.once('error', deferred.reject);
            currModel.once('ready', function() {
                if (_.isEmpty(pathSegs)) {
                    // We've reached the end of the path. Do the actual check.
                    var result;

                    if (_.contains(DATE_PROPS, qParamName)) {
                        result = checkDateProp(qParamVal, qParamName, qpSchema, currModel, finalAttrName);
                    } else { // simple property check
                        result = currModel.get(finalAttrName) === qParamVal ? INCLUDE : EXCLUDE;
                    }

                    if (result === INCLUDE) {
                        deferred.resolve(result);
                    } else {
                        deferred.reject(result);
                    }
                } else {
                    // recursive case - continue following path segments.
                    var currPart = '$' + pathSegs.shift();
                    var newModel = currModel.get(currPart);
                    followNextSeg(newModel);
                }
            });
        }

        followNextSeg(model);

        return deferred.promise();
    }

    function getRootedSchema(model) {
        function upwardFind(schema, schemaName) {
            if (dx.core.util.isNone(schema)) {
                dx.fail('Malformed type. Root schema type not found.');
            }

            if (schema.name === schemaName) {
                return schema;
            }

            return upwardFind(schema.parentSchema, schemaName);
        }

        if (!model._dxSchema.rootTypeName) {
            dx.fail('Trying to filter a type that has no root type.');
        }

        return upwardFind(model._dxSchema, model._dxSchema.rootTypeName);
    }

    /*
     * This is the filter to rule all filters. It will filter models for a given collection based on the schema
     * definition and annotations. This may be used as a standalone filter or as a helper for another filter, usually
     * in conjunction with the 'skipParams' argument (see alertFilter).
     * The uberFilter can only handle 'standard' query parameters: simple equality checks, date comparisons, and
     * paging. Similarly there are instances of query parameters that the uberFilter should not attempt to handle.
     * These come in two flavors:
     * 1) Params that do not affect what comes back from the notification system are marked as 'excludeFromFilter' in
     *    the schemas.
     * 2) Params that require special handling can be passed to the uberFilter using the 'skipParams' array.
     */
    function uberFilter(collection, model, resultHandler, skipParams) {
        var qParams = collection.getQueryParameters() || {};
        var schemaDef = getRootedSchema(model);
        var listParams = schemaDef.list.parameters;

        // If the schema definition for list says there are no parameters, then the model can always be included
        if (_.isEmpty(schemaDef.list.parameters)) {
            resultHandler(INCLUDE);
        }

        qParams = _.omit(qParams, skipParams);

        /*
         * If a type could have pageSize, we may need to return UNKNOWN. Otherwise we can keep going in the filter.
         * Note that we don't care about paging params when dealing with creation listeners.
         */
        if (_.has(listParams, 'pageSize') && collection instanceof Backbone.Collection) {
            var pageSizeResult = checkPageSize(qParams);
            if (pageSizeResult === UNKNOWN) {
                return resultHandler(pageSizeResult);
            }
        }
        qParams = _.omit(qParams, ['pageSize', 'pageOffset']);

        if (_.isEmpty(qParams)) {
            return resultHandler(INCLUDE);
        }
        var promises = _.map(qParams, function(qParamVal, qParamName) {
            return checkQueryParam(qParamVal, qParamName, model, schemaDef);
        });

        /*
         * Wait until all query param checks have resolved to make a final decision. Params that might result in
         * UNKNOWN (paging and params we can't handle) are dealt with earlier. Therefore we know each of these promises
         * is either resolved with INCLUDE or rejected with EXCLUDE.
         */
        return $.when.apply(undefined, promises)
            .then(function() {
                resultHandler(INCLUDE);
            })
            .fail(function() {
                resultHandler(EXCLUDE);
            });
    }

    /*
     * Simple filter for any type that doesn't actually have query parameters on its list operation (e.g. Group).
     */
    function genericFilter(collection, model, resultHandler) {
        resultHandler(INCLUDE);
    }

    /*
     * Do the real work.
     */
    context = context || this;
    context._filters = context._filters || {};

    _.extend(context._filters, {
        EXCLUDE: EXCLUDE,
        INCLUDE: INCLUDE,
        UNKNOWN: UNKNOWN,
        Notification: uberFilter,
        _checkSameProps: checkSameProps,
        _genericFilter: genericFilter,
        _uberFilter: uberFilter
    });
};

})();
