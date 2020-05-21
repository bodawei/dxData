# dxData
## What is it
dxData is a system for communicating data between a client and a server.  It involves several key ideas:
* Reactivity: Changes in server data are reflected immediately on the client without an app developer needing to do special work.
* Unidirectionality: The data "source of truth" is to be found on the server. Changes to that data go through the server (the client doesn't try to out-think the server)
* Common types: The data and operations communicated between client and server are defined in a language neutral form that assures that both
the client and the server code is always in lockstep agreement, preventing code from inadvertently diverging, and helping to support the previous
two principles.

In this repository is a JavaScript library (dxData) which provides the client side of this interaction pattern, and a base set of schemas (definitions of common data types).
Both are general enough that you can build your own types and operations on top of them and reap the other benefits the dxData system provides.

All of the principles involved here are language and implementation neutral, and it is fairly easy to build new clients (and servers) to embody them.
To this end, there is also a demo application included as part of this repository which has simple server written in Python that demonstrates the ideas
involved here, and uses dxData on the client side.  A client developer can see that with no special effort on their part, they can get reactive data
showing up in their application.

## Layout of the directory
* demo         : Contains a demo application
* Gruntfile.js : The build file for the contents of this directory
* LICENSE      : The usual license for this software
* package.json : a nodejs/npm file that tells npm what it needs to install to use this
* README.md    : This file
* schema       : Basic JSON schemas for data types needed for using the dxData system

## How to get started
1. Try out the demo!
2. Read the source!

## How to run the demo
1. Install [node.js](http://nodejs.org)
2. Install [Python 2.7.x](https://www.python.org/downloads/)
3. Run `npm install -g grunt-cli` to install [grunt-cli](http://gruntjs.com/getting-started)
3. `cd demo`  (from the directory this README is in)
4. `npm install`
5. `grunt`
  * For Windows users, see [Does Grunt work on Windows](http://gruntjs.com/frequently-asked-questions) (short answer: yes, but you may want to avoid cygwin).
5. `grunt server` to start the server
6. Visit http://localhost:8888 from one (or, preferably, multiple) browsers

## Using the demo
The demo is of short message application called Buzzr.  Using this, you can type small messages (Buzzes) that will be
seen by all other Buzzr users.

1. Type in a Buzz you want to send, and click Buzz
  * All users will receive the message reactively!
2. Click on the user name ("YourName") to edit your user name. This demonstrates the unidirectional data change paradig.

Note: None of the data is persistent. So when you kill the server, all your messages will go away!

## How to build the main project
* Needs node.js 10 or later
* `npm test` will run the unit tests
* `npm build` will build the `dist/` directory

## What comes next?
There is a lot more to be said here, and we expect to add more documentation and information to this project soon.
In the mean time, try this out, send us questions and comments.

## Who gets credit?
dxData is, like all such projects, a result of the ideas and contributions of many people.  The primary names, alphabetically, are:
* Aaron Garvey
* Abdullah Mourad
* Brett Lazarus
* Chris Patten
* Chris Siden
* Eyal Kaspi
* Dan Kimmel
* David Burrowes
* Eric Schrock
* Henrik Mattsson
* Henry Rodrick
* Prateek Sharma
* You?

## Legalness
```
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
```

Copyright (c) 2014-2016 by Delphix. All rights reserved.


