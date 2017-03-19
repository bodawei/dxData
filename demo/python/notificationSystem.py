#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

#
# Copyright (c) 2014 by Delphix. All rights reserved.
#

from schemaTypes import ObjectNotification
from schemaTypes import ListResult
from returnValues import makeListResult
from time import *

#
# A simple notification system that, when it is told that there has been a create, update
# or delete, will queue results for all clients.  In addition, it will service requests for
# notifications for a specific session, waiting for up to 10 seconds for notifications
# before returning.
#
class NotificationSystem():
    sessionSystem = None
    
    def __init__(self, sessionSystem):
        self.sessionSystem = sessionSystem

    def _createNotification(self, opType, typeName, reference):
        """ Create a notification in each session's queue """
        notification = ObjectNotification();
        notification.eventType = opType
        notification.object = reference
        notification.objectType = typeName
        self.sessionSystem.queueNotification(notification)

    def create(self, typeName, reference):
        self._createNotification('CREATE', typeName, reference)

    def update(self, typeName, reference):
        self._createNotification('UPDATE', typeName, reference)

    def delete(self, typeName, reference):
        self._createNotification('DELETE', typeName, reference)

    def getListResult(self, session, params):
        """ Keep trying to get the set of notifications for the specified session, or return [] after a timeout """
        timeout = 10
        if "timeout" in params:
            timeout = params["timeout"]
        finishTime = time() + (int(timeout) / 1000)
        queue = session.getNotifications(params["channel"])
        while len(queue) is 0 and time() < finishTime:
            sleep(0.05)
            queue = session.getNotifications(params["channel"])
        return makeListResult(queue)
