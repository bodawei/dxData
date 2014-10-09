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

from BaseHTTPServer import HTTPServer, BaseHTTPRequestHandler
from SimpleHTTPServer import SimpleHTTPRequestHandler
from SocketServer import ThreadingMixIn
from simpleSession import SimpleSessionManager
from simpleStorage import SimpleStorage
from notificationSystem import NotificationSystem
from schemaObjectManager import doSchemaObjectOperation
from schemaObjectManager import rootedTypeForType
import json
import string

sessionManager = SimpleSessionManager()
notificationSys = NotificationSystem(sessionManager)
storage = SimpleStorage(rootedTypeForType, notificationSys)

class Handler(SimpleHTTPRequestHandler):
    def _doHandle(self, httpOperation):
        """Respond to a GET request."""
        try:
            session = sessionManager.getSessionFromHttpHeaders(self.headers, storage)
            payload = None
            length = self.headers.getheader('content-length')
            if length is not None:
                intLength = int(length)
                if intLength > 0:
                    payload = self.rfile.read(intLength)

            # special case notifications
            if self.path.startswith('/webapi/notification') and httpOperation is 'GET':
                result =  {
                    'code': 200,
                    'obj': notificationSys.getListResult(session)
                }
            else:
                if payload is not None and len(payload) > 0:
                    try:
                        payload = json.loads(payload)
                    except ValueError:
                        payload = None
                context = {
                    "storage": storage,
                    "session": session
                }
                result = doSchemaObjectOperation(context, self.path, httpOperation, payload)
        except BaseException as e:
            print("EXCEPTION DURING REQUEST HANDLING: " + str(e))
            result = {
                'code': 500,
                'obj': None
            }
        
        self.send_response(result['code'])
        session.writeSessionHeader(self)

        if result['obj'] is not None:
            self.send_header('Content-Type', 'text/json')
            self.end_headers()
            print('   # RESULT: ' + json.dumps(result['obj'].toJson()))
            self.wfile.write(result['obj'].toJson())
        else:
            self.end_headers()
            self.wfile.write('')

    def do_GET(self):
        if self.path.startswith("/webapi"):
            self._doHandle('GET')
        else:
            SimpleHTTPRequestHandler.do_GET(self)
    
    def do_POST(self):
        if self.path.startswith("/webapi"):
            self._doHandle('POST')

    def do_DELETE(self):
        if self.path.startswith("/webapi"):
            self._doHandle('DELETE')


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    """Handle requests in a separate thread."""

if __name__ == '__main__':
    server = ThreadedHTTPServer(('localhost', 8888), Handler)
    print 'Starting server at http://localhost:8888, use <Ctrl-C> to stop'
    server.serve_forever()


