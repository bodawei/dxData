/*
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
 * Copyright (c) 2014, 2015 by Delphix. All rights reserved.
 */

/*global dx, _ */

'use strict';

dx.namespace('dx.test.dataMocks');

/*
 * Various mock objects used for data tests
 */
(function() {
_.extend(dx.test.dataMocks, {
    // must be given the schemaKey of 'call' when registering
    callResultSchema: {
        name: 'CallResult',
        properties: {
            type: {
                type: 'string'
            }
        }
    },
    okResultSchema: {
        name: 'OKResult',
        'extends': {
            $ref: 'call'
        },
        properties: {
            result: {
                type: ['object', 'string', 'array']
            }
        }
    },
    // must be given the schemaKey of 'api' when registering
    apiErrorSchema: {
        name: 'APIError',
        'extends': {
            $ref: 'call'
        },
        properties: {
            details: {
                type: ['object', 'array', 'string']
            },
            commandOutput: {
                type: 'string'
            }
        }
    },
    errorResultSchema: {
        name: 'ErrorResult',
        properties: {
            type: {
                type: 'string'
            },
            error: {
                type: 'object',
                $ref: 'api'
            }
        }
    },
    notificationSchema: {
        root: '/api/notification',
        name: 'Notification',
        properties: {
            type: {
                type: 'string'
            }
        },
        list: {
            parameters: {
                channel: {
                    type: 'string'
                },
                timeout: {
                    type: 'string'
                }
            }
        }
    }
});

})();
