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
 * Copyright (c) 2015 by Delphix. All rights reserved.
 */

/*eslint-env jasmine */
/*global dx */

'use strict';

dx.namespace('dx.test');

/*
 * Core dxData schemas.  This is a subset of the Delphix Schemas, with certain dependencies removed so that we can
 * use this subset without dragging in hundreds of other types.
 */
dx.test.CORE_SCHEMAS = {
    '/delphix-api-error.json': {
        copyright: 'Copyright (c) 2014 by Delphix. All rights reserved.',
        license: 'Apache-2.0',
        name: 'APIError',
        description: 'Description of an error encountered during an API call.',
        extends: {
            $ref: '/delphix-typed-object.json'
        },
        properties: {
            details: {
                type: [
                    'object',
                    'string'
                ],
                description: 'For validation errors, a map of fields to APIError objects. For all other errors, a ' +
                    'string with further details of the error.'
            },
            action: {
                type: 'string',
                description: 'Action to be taken by the user, if any, to fix the underlying problem.'
            },
            id: {
                type: 'string',
                description: 'A stable identifier for the class of error encountered.'
            },
            commandOutput: {
                type: 'string',
                description: 'Extra output, often from a script or other external process, that may give more ' +
                    'insight into the cause of this error.'
            }
        }
    },
    '/delphix-call-result.json': {
        copyright: 'Copyright (c) 2014 by Delphix. All rights reserved.',
        license: 'Apache-2.0',
        name: 'CallResult',
        description: 'Result of an API call.',
        extends: {
            $ref: '/delphix-typed-object.json'
        },
        properties: {
            status: {
                type: 'string',
                description: 'Indicates whether an error occurred during the call.',
                enum: [
                    'OK',
                    'ERROR'
                ]
            }
        }
    },
    '/delphix-error-result.json': {
        copyright: 'Copyright (c) 2014 by Delphix. All rights reserved.',
        license: 'Apache-2.0',
        name: 'ErrorResult',
        description: 'Result of a failed API call.',
        extends: {
            $ref: '/delphix-call-result.json'
        },
        properties: {
            error: {
                type: 'object',
                description: 'Specifics of the error that occurred during API call execution.',
                $ref: '/delphix-api-error.json'
            }
        }
    },
    '/delphix-list-result.json': {
        copyright: 'Copyright (c) 2014 by Delphix. All rights reserved.',
        license: 'Apache-2.0',
        name: 'ListResult',
        description: 'Result of a successful API call returning a list.',
        extends: {
            $ref: '/delphix-ok-result.json'
        },
        properties: {
            total: {
                type: 'integer',
                description: 'The number of items in the entire result set, regardless of the requested page size. ' +
                    'For some operations, this value is null.'
            },
            overflow: {
                type: 'boolean',
                description: 'True if the total number of matching items is too large to be calculated.'
            }
        }
    },
    '/delphix-notification-drop.json': {
        copyright: 'Copyright (c) 2014 by Delphix. All rights reserved.',
        license: 'Apache-2.0',
        name: 'NotificationDrop',
        description: 'An object to track dropped notifications.',
        extends: {
            $ref: '/delphix-notification.json'
        },
        properties: {
            dropCount: {
                description: 'The number of notifications which were dropped since the last notifications were ' +
                    'pulled. If this is greater than zero, you may want to refresh your view of the data to ensure ' +
                    'everything is up to date.',
                type: 'integer'
            }
        }
    },
    '/delphix-notification.json': {
        copyright: 'Copyright (c) 2014 by Delphix. All rights reserved.',
        license: 'Apache-2.0',
        name: 'Notification',
        description: 'Base type for all notification types.',
        root: '/webapi/notification',
        cliVisibility: [],
        extends: {
            $ref: '/delphix-typed-object.json'
        },
        list: {
            description: 'Returns a list of pending notifications for the current session.',
            parameters: {
                channel: {
                    type: 'string',
                    description: 'Client-specific ID to specify an independent channel.'
                },
                timeout: {
                    type: 'string',
                    description: 'Timeout, in milliseconds, to wait for one or more responses.'
                },
                max: {
                    type: 'string',
                    description: 'Maximum number of entries to reutrn at once.'
                }
            },
            return: {
                type: 'array',
                items: {
                    type: 'object',
                    $ref: '/delphix-notification.json'
                }
            }
        }
    },
    '/delphix-object-notification.json': {
        copyright: 'Copyright (c) 2014 by Delphix. All rights reserved.',
        license: 'Apache-2.0',
        name: 'ObjectNotification',
        description: 'An event indicating a change to an object on the system.',
        extends: {
            $ref: '/delphix-notification.json'
        },
        properties: {
            object: {
                type: 'string',
                description: 'Target object reference.',
                format: 'objectReference',
                referenceTo: '/delphix-persistent-object.json'
            },
            objectType: {
                type: 'string',
                description: 'Type of target object.',
                format: 'type'
            },
            eventType: {
                type: 'string',
                enum: [
                    'CREATE',
                    'UPDATE',
                    'DELETE'
                ],
                description: 'Type of operation on the object.'
            }
        }
    },
    '/delphix-ok-result.json': {
        copyright: 'Copyright (c) 2014 by Delphix. All rights reserved.',
        license: 'Apache-2.0',
        name: 'OKResult',
        description: 'Result of a successful API call.',
        extends: {
            $ref: '/delphix-call-result.json'
        },
        properties: {
            result: {
                type: [
                    'object',
                    'array',
                    'string'
                ],
                description: 'Result of the operation. This will be specific to the API being invoked.'
            }
        }
    },
    '/delphix-persistent-object.json': {
        copyright: 'Copyright (c) 2014 by Delphix. All rights reserved.',
        license: 'Apache-2.0',
        description: 'Super schema for all typed schemas with a reference property.',
        extends: {
            $ref: '/delphix-typed-object.json'
        },
        name: 'PersistentObject',
        properties: {
            reference: {
                description: 'Object reference',
                format: 'objectReference',
                referenceTo: '/delphix-persistent-object.json',
                type: 'string'
            }
        }
    },
    '/delphix-singleton-update.json': {
        copyright: 'Copyright (c) 2014 by Delphix. All rights reserved.',
        license: 'Apache-2.0',
        description: 'An event indicating an update to a singleton object on the system.',
        extends: {
            $ref: '/delphix-notification.json'
        },
        name: 'SingletonUpdate',
        properties: {
            objectType: {
                description: 'Type of target object.',
                format: 'type',
                type: 'string'
            }
        }
    },
    '/delphix-typed-object.json': {
        copyright: 'Copyright (c) 2014 by Delphix. All rights reserved.',
        license: 'Apache-2.0',
        description: 'Super schema for all other schemas',
        name: 'TypedObject',
        properties: {
            type: {
                description: 'Object type',
                format: 'type',
                required: true,
                type: 'string'
            }
        }
    }
};
