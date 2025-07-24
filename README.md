# The HTTP Client for WeChat Mini Program

[![CI](https://github.com/Beautiful-Bubble/wave/actions/workflows/ci.yml/badge.svg)](https://github.com/Beautiful-Bubble/wave/actions/workflows/ci.yml)

Wave is an HTTP client designed for WeChat Mini Programs. It aims to enhance
the developer experience when sending HTTP requests.

## Installation

To install the package, navigate to the root directory of your WeChat Mini
Program. You can install it using NPM:

```bash
npm i @beautiful-bubble/wave
```

After installation, remember to run the "Build NPM Package" command in the
WeChat Mini Program development tools.

## Sending HTTP Requests

Wave features a set of intuitive APIs that help you quickly create HTTP
requests.

```ts
import { Client } from '@beautiful-bubble/wave'

Client.new().get('http://www.example.com')
Client.new().post('http://www.example.com')
Client.new().put('http://www.example.com')
Client.new().delete('http://www.example.com')
```

You can also pass an object as the second parameter along with the request to
specify the body data. The default content type for HTTP requests is set to
JSON. Since HTTP GET requests do not have a body, the object will be formatted
as a query string.

```ts
Client.new().get('http://www.example.com/api/users', ['search' => 'Zhineng'])
```

When you're ready to get the response, you can `await` the invocation. Wave
also provides a comprehensive `Response` instance with intuitive APIs.

```ts
const response = await Client.new().get('http://www.example.com')
console.log(response.data())
```

We understand that you may need to abort outgoing HTTP requests in some
situations; in that case, you can simply retrieve the request task without
using the `await` operator.

```ts
const { task } = Client.new().get('http://www.example.com')
task.abort()
```

## Configure base URL

It can be tedious to specify the full endpoint in every HTTP request throughout
the application. You can set the base URL at the application level in the
`app.ts` or `app.js` file, and all subsequent HTTP requests will then respect
this endpoint.

```ts
// app.ts

Client.baseUrl('http://www.example.com')

// page.ts

Client.new().get('/api/users')
```

## Request timeout

WeChat Mini Programs have a one-minute default timeout for HTTP requests.
You can shorten this by passing the desired time in milliseconds to the
timeout API.

```ts
Client.new().timeout(3000).get('/')
```

## Middleware

Wave streamlines the organization and reuse of code for HTTP requests. Through
its middleware, you can intercept or modify HTTP requests, such as by
configuring authentication tokens or recording outgoing requests.

```ts
Client.use((request, next) => {
    return next(request.withHeader('Authorization', 'Bearer ...'))
})
```

## License

The package is released under [the MIT license](LICENSE).
