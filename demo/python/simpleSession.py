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
import Cookie
import threading
from schemaTypes import User

# Extremely coarse grained lock
sessionLock = threading.Lock();

class Session:
    """
    A simple object representing a single session
    """
    sessionId = 0
    queue = []
    user = None
    
    def __init__(self, sessionId):
        self.sessionId = sessionId;
    
    def writeSessionHeader(self, requestHandler):
        requestHandler.send_header("Set-Cookie", "session=" + str(self.sessionId))

    def getNotifications(self):
        sessionLock.acquire();
        before = len(self.queue)
        oldQueue = self.queue
        self.queue = []
        sessionLock.release();
        return oldQueue


class SimpleSessionManager():
    """
    Utility routines for manaing a set of sessions.
    """
    nextSession = 1
    sessions = {}
    
    def getSessionFromHttpHeaders(self, httpHeaders, storage):
        cookieText = httpHeaders.getheader("Cookie")
        cookies = Cookie.SimpleCookie(cookieText)
        sessionCookie = cookies.get("session")
        sessionId = 0
        if sessionCookie:
            sessionId = int(sessionCookie.value)

        if not sessionId in self.sessions:
            sessionLock.acquire();
            sessionId = self.nextSession
            self.nextSession = self.nextSession + 1
            sessionLock.release()
            newSession = Session(sessionId);

            userObject = User()
            userObject.name = "Nameless Person"
            storage.add(userObject);
            newSession.user = userObject
            self.sessions[sessionId] = newSession

        chosenSession = self.sessions[sessionId]

        return chosenSession

    def queueNotification(self, notification):
        sessionLock.acquire();
        for key in self.sessions:
            session = self.sessions[key]
            session.queue.append(notification)
        sessionLock.release();


