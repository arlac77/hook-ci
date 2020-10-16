[![npm](https://img.shields.io/npm/v/hook-ci.svg)](https://www.npmjs.com/package/hook-ci)
[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)
[![minified size](https://badgen.net/bundlephobia/min/hook-ci)](https://bundlephobia.com/result?p=hook-ci)
[![downloads](http://img.shields.io/npm/dm/hook-ci.svg?style=flat-square)](https://npmjs.org/package/hook-ci)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/arlac77/hook-ci.git)

# hook-ci

simple ci to be triggered by git hooks

# API

<!-- Generated by documentation.js. Update this documentation by updating the source code. -->

### Table of Contents

-   [defaultQueuesConfig](#defaultqueuesconfig)
-   [queueTypes](#queuetypes)
-   [analyseJob](#analysejob)
    -   [Parameters](#parameters)
-   [extractCINotification](#extractcinotification)
    -   [Parameters](#parameters-1)
-   [streamIntoJob](#streamintojob)
    -   [Parameters](#parameters-2)
-   [stripUnusedDataFromHookRequest](#stripunuseddatafromhookrequest)
    -   [Parameters](#parameters-3)
-   [wellKnownScripts](#wellknownscripts)
-   [buildAnalyse](#buildanalyse)
    -   [Parameters](#parameters-4)
-   [authenticate](#authenticate)
    -   [Parameters](#parameters-5)
-   [accessTokenGenerator](#accesstokengenerator)
    -   [Parameters](#parameters-6)
-   [LocalNode](#localnode)
    -   [Parameters](#parameters-7)

## defaultQueuesConfig

default configuration for queues

## queueTypes

map queue names
to processing

## analyseJob

analyse the incoming job and prepare the steps to be executed in the processing queue(s)

### Parameters

-   `job` **Job** 
-   `bus` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

## extractCINotification

extract ci notification from line

### Parameters

-   `line` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** 

Returns **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** notification body or undefined

## streamIntoJob

add log entries to a job

### Parameters

-   `stream` **ReadableStream** 
-   `job` **Job** 
-   `step`  
-   `notificationHandler` **[Function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Statements/function)** 

## stripUnusedDataFromHookRequest

strip away currently unused request data

### Parameters

-   `request` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** decodec webhook request data

Returns **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** stipped down request data

## wellKnownScripts

npm buildin scripts

## buildAnalyse

search for build.sh

### Parameters

-   `branch`  
-   `job`  
-   `config`  
-   `wd`  

## authenticate

authorize user / password

### Parameters

-   `config` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
-   `username` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** 
-   `password` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** 

Returns **[Set](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Set)&lt;[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)>** entitlements

## accessTokenGenerator

Generate a request handler to deliver JWT access tokens

### Parameters

-   `config` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** 
-   `entitlementFilter` **[Function](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Statements/function)** 

Returns **any** request handler return jwt token

## LocalNode

**Extends Node**

the node we are ourselfs

### Parameters

-   `name`  
-   `options`  
