type MessageHeader = Record<string, string>
type QueryString = Record<string, string>
type HttpMethod = WechatMiniprogram.RequestOption['method']
type RequestTask = WechatMiniprogram.RequestTask | WechatMiniprogram.UploadTask
type RequestData = Record<string, unknown>
type ResponseData = WechatMiniprogram.RequestSuccessCallbackResult['data']
type MiddlewareNext<T extends ResponseData> = (
  request: PendingRequest
) => RequestPromise<Response<SuccessCallbackResult<T>, T>>
type Middleware<T extends ResponseData> = (
  request: PendingRequest,
  next: MiddlewareNext<T>
) => RequestPromise<Response<SuccessCallbackResult<T>, T>>
type SuccessCallbackResult<T extends ResponseData> =
  | WechatMiniprogram.RequestSuccessCallbackResult<T>
  | WechatMiniprogram.UploadFileSuccessCallbackResult
type RequestPromise<T> = Promise<T> & {
  task: RequestTask
}

export class Response<
  T extends SuccessCallbackResult<U>,
  U extends ResponseData
> {
  #response

  constructor(response: T) {
    this.#response = response
  }

  status() {
    return this.#response.statusCode
  }

  ok() {
    return this.status() === 200
  }

  successful() {
    const status = this.status()
    return status >= 200 && status < 300
  }

  clientError() {
    const status = this.status()
    return status >= 400 && status < 500
  }

  serverError() {
    const status = this.status()
    return status >= 500 && status < 600
  }

  data(): T extends SuccessCallbackResult<infer U> ? U : never {
    return this.#response.data as T extends SuccessCallbackResult<infer U>
      ? U
      : never
  }

  json() {
    const data = this.data()
    if (typeof data === 'string') {
      try {
        return JSON.parse(data)
      } catch {
        return {}
      }
    }
    return data
  }

  raw() {
    return this.#response
  }
}

class PendingRequest {
  #httpMethod!: HttpMethod

  #baseUrl: string | null = null

  #url!: string

  #query: QueryString = {}

  #header: MessageHeader = {}

  #data: RequestData = {}

  #middlewares: Middleware<any>[] = []

  method(method: HttpMethod) {
    const request = this.#clone()
    request.#httpMethod = method
    return request
  }

  baseUrl(baseUrl: string | null) {
    const request = this.#clone()
    request.#baseUrl = baseUrl
    return request
  }

  url(url: string) {
    const request = this.#clone()
    request.#url = url
    return request
  }

  withQuery(query: QueryString) {
    const request = this.#clone()
    request.#query = query
    return request
  }

  hasHeader(name: string) {
    return name in this.#header
  }

  withHeader(name: string, value: string) {
    const request = this.#clone()
    request.#header[name] = value
    return request
  }

  getHeaderLine(name: string) {
    return this.#header[name] ?? null
  }

  header() {
    return this.#header
  }

  asJson() {
    return this.withHeader('content-type', 'application/json')
  }

  asForm() {
    return this.withHeader('content-type', 'application/x-www-form-urlencoded')
  }

  asMultipart() {
    return this.withHeader('content-type', 'multipart/form-data')
  }

  isJson() {
    return this.getHeaderLine('content-type') === 'application/json'
  }

  withBody(data: RequestData) {
    const request = this.#clone()
    request.#data = data
    return request
  }

  body() {
    return this.#data
  }

  use(fn: Middleware<any> | Middleware<any>[]) {
    const request = this.#clone()
    const handlers = Array.isArray(fn) ? fn : [fn]
    for (const handler of handlers) {
      request.#middlewares.push(handler)
    }
    return request
  }

  get<T extends ResponseData>(url: string, data: QueryString = {}) {
    return this.method('GET').url(url).withQuery(data).#send<T>()
  }

  post<T extends ResponseData>(url: string, data: RequestData = {}) {
    return this.method('POST').url(url).withBody(data).#send<T>()
  }

  put<T extends ResponseData>(url: string, data: RequestData = {}) {
    return this.method('PUT').url(url).withBody(data).#send<T>()
  }

  delete<T extends ResponseData>(url: string, data: QueryString = {}) {
    return this.method('DELETE').url(url).withQuery(data).#send<T>()
  }

  upload(
    option: Pick<
      WechatMiniprogram.UploadFileOption,
      'url' | 'filePath' | 'name'
    >
  ) {
    const request = this.url(option.url).asMultipart()

    return this.#throughMiddlewares(request)(
      this.#dispatchUpload(option.name, option.filePath)
    )
  }

  #dispatchUpload(name: string, filePath: string) {
    return (request: PendingRequest) => {
      let resolveHandler: (
        value: Response<
          WechatMiniprogram.UploadFileSuccessCallbackResult,
          string
        >
      ) => void
      let rejectHandler: (
        error: WechatMiniprogram.GeneralCallbackResult
      ) => void

      const promise = new Promise((resolve, reject) => {
        resolveHandler = resolve
        rejectHandler = reject
      }) as RequestPromise<
        Response<WechatMiniprogram.UploadFileSuccessCallbackResult, string>
      >

      promise.task = wx.uploadFile({
        url: request.#buildUrl(),
        filePath,
        name,
        header: request.#header,
        enableHttp2: true,
        success(res) {
          resolveHandler(new Response(res))
        },
        fail(err) {
          rejectHandler(err)
        }
      })

      return promise
    }
  }

  #send<T extends ResponseData>(): RequestPromise<
    Response<SuccessCallbackResult<T>, T>
  > {
    return this.#throughMiddlewares<T>(this)(this.#dispatchRequest<T>)
  }

  #dispatchRequest<T extends ResponseData>(request: PendingRequest) {
    let resolveHandler: (
      value: Response<WechatMiniprogram.RequestSuccessCallbackResult<T>, T>
    ) => void
    let rejectHandler: (error: WechatMiniprogram.RequestFailCallbackErr) => void

    const promise = new Promise((resolve, reject) => {
      resolveHandler = resolve
      rejectHandler = reject
    }) as RequestPromise<
      Response<WechatMiniprogram.RequestSuccessCallbackResult<T>, T>
    >

    promise.task = wx.request<T>({
      url: request.#buildUrl(),
      data: request.body(),
      header: request.#header,
      method: request.#httpMethod,
      dataType: request.isJson() ? 'json' : '其他',
      responseType: 'text',
      useHighPerformanceMode: true,
      success: (res) => {
        resolveHandler(new Response(res))
      },
      fail: (err) => {
        rejectHandler(err)
      }
    })

    return promise
  }

  #throughMiddlewares<T extends ResponseData>(request: PendingRequest) {
    return (handler: MiddlewareNext<T>) =>
      this.#middlewares.reduceRight(
        (next: MiddlewareNext<T>, middleware) => (request: PendingRequest) =>
          middleware(request, next),
        handler
      )(request)
  }

  #clone() {
    const request = new PendingRequest()
    request.#httpMethod = this.#httpMethod
    request.#baseUrl = this.#baseUrl
    request.#url = this.#url
    request.#query = { ...this.#query }
    request.#header = { ...this.#header }
    request.#data = { ...this.#data }
    request.#middlewares = [...this.#middlewares]
    return request
  }

  #buildUrl() {
    let url = this.#url.endsWith('/') ? this.#url.slice(0, -1) : this.#url

    if (this.#baseUrl !== null && !url.match(/^[0-9a-zA-Z]+:\/\//)) {
      const baseUrl = this.#baseUrl.endsWith('/')
        ? this.#baseUrl.slice(0, -1)
        : this.#baseUrl
      const path = url.startsWith('/') ? url.slice(1) : url
      url = path === '' ? baseUrl : `${baseUrl}/${path}`
    }

    const query = this.#buildQueryString()

    return query === '' ? url : `${url}?${query}`
  }

  #buildQueryString() {
    return Object.keys(this.#query)
      .map((name) =>
        [encodeURIComponent(name), encodeURIComponent(this.#query[name])].join(
          '='
        )
      )
      .join('&')
  }
}

export class Factory {
  #baseUrl: string | null = null

  #middlewares: Middleware<any>[] = []

  new() {
    return new PendingRequest()
      .baseUrl(this.#baseUrl)
      .use(this.#middlewares)
      .asJson()
  }

  baseUrl(baseUrl: string) {
    this.#baseUrl = baseUrl
    return this
  }

  use(fn: Middleware<any> | Middleware<any>[]) {
    const handlers = Array.isArray(fn) ? fn : [fn]
    for (const handler of handlers) {
      this.#middlewares.push(handler)
    }
    return this
  }
}

export const Client = new Factory()
