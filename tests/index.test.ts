import { Factory, Response } from '../src'

describe('HTTP Client', () => {
  beforeEach(() => {
    // @ts-expect-error: TypeScript complaints because 'wx' is not defined on
    // the global object in Node.js. We're here to mock the global 'wx' object
    // for testing purposes.
    global.wx = {
      request: jest.fn(),
      uploadFile: jest.fn()
    }
  })

  afterEach(() => {
    // @ts-expect-error: Clean up the mocked global 'wx' object
    delete global.wx
  })

  describe('Response', () => {
    it.each([[200], [400]])(
      'retrieves the status code',
      (statusCode: number) => {
        const response = new Response({
          data: {},
          statusCode,
          header: {},
          cookies: []
        } as unknown as WechatMiniprogram.RequestSuccessCallbackResult)
        expect(response.status()).toBe(statusCode)
      }
    )

    it.each([
      [200, true],
      [201, false],
      [299, false],
      [300, false],
      [304, false],
      [400, false],
      [500, false]
    ])('should correctly determine if response is OK', (statusCode, ok) => {
      const response = new Response({
        data: '',
        statusCode,
        header: {},
        cookies: []
      } as unknown as WechatMiniprogram.RequestSuccessCallbackResult)
      expect(response.ok()).toBe(ok)
    })

    it.each([
      [200, true],
      [201, true],
      [299, true],
      [300, false],
      [304, false],
      [400, false],
      [500, false]
    ])(
      'should correctly determine if response is successful',
      (statusCode, successful) => {
        const response = new Response({
          data: '',
          statusCode,
          header: {},
          cookies: []
        } as unknown as WechatMiniprogram.RequestSuccessCallbackResult)
        expect(response.successful()).toBe(successful)
      }
    )

    it.each([
      [200, false],
      [201, false],
      [300, false],
      [304, false],
      [400, true],
      [401, true],
      [402, true],
      [499, true],
      [500, false]
    ])(
      'should correctly determine if response is a client error',
      (statusCode, clientError) => {
        const response = new Response({
          data: '',
          statusCode,
          header: {},
          cookies: []
        } as unknown as WechatMiniprogram.RequestSuccessCallbackResult)
        expect(response.clientError()).toBe(clientError)
      }
    )

    it.each([
      [200, false],
      [201, false],
      [300, false],
      [304, false],
      [400, false],
      [500, true],
      [503, true]
    ])(
      'should correctly determine if response is a server error',
      (statusCode, serverError) => {
        const response = new Response({
          data: '',
          statusCode,
          header: {},
          cookies: []
        } as unknown as WechatMiniprogram.RequestSuccessCallbackResult)
        expect(response.serverError()).toBe(serverError)
      }
    )

    it.each([
      [{ foo: 'bar' }, { foo: 'bar' }],
      ['foo', 'foo']
    ])('retrieves the data', (data, expected) => {
      const response = new Response({
        data,
        statusCode: 200,
        header: {},
        cookies: []
      } as unknown as WechatMiniprogram.RequestSuccessCallbackResult)
      expect(response.data()).toStrictEqual(expected)
    })

    it.each([
      ['{"foo":"bar"}', { foo: 'bar' }],
      [{ foo: 'bar' }, { foo: 'bar' }]
    ])('decodes the data as JSON string', (data, expected) => {
      const response = new Response({
        data,
        statusCode: 200,
        header: {},
        cookies: []
      } as unknown as WechatMiniprogram.RequestSuccessCallbackResult)
      expect(response.json()).toStrictEqual(expected)
    })

    it('returns an empty object when it fails to decode the data as JSON string', () => {
      const response = new Response({
        data: '-',
        statusCode: 200,
        header: {},
        cookies: []
      } as unknown as WechatMiniprogram.RequestSuccessCallbackResult)
      expect(response.json()).toStrictEqual({})
    })

    it('retrieves the raw response', () => {
      const rawResponse = {
        data: '',
        statusCode: 200,
        header: {},
        cookies: []
      } as unknown as WechatMiniprogram.RequestSuccessCallbackResult
      const response = new Response(rawResponse)
      expect(response.raw()).toStrictEqual(rawResponse)
    })
  })

  describe('PendingRequest', () => {
    it.each([
      ['get', 'GET'],
      ['post', 'POST'],
      ['put', 'PUT'],
      ['delete', 'DELETE']
    ] as const)('sends HTTP request', (method, httpMethod: string) => {
      const factory = new Factory()
      factory.new()[method]('http://example.com')
      expect(wx.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://example.com',
          method: httpMethod
        })
      )
    })

    it.each([
      [{ foo: 'bar' }, '?foo=bar'],
      [{ foo: 'bar', baz: 'qux' }, '?foo=bar&baz=qux'],
      [{}, '']
    ])('sends HTTP request with query string', (query, expected) => {
      const factory = new Factory()
      factory.new().get('http://example.com', query)
      expect(wx.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `http://example.com${expected}`,
          method: 'GET',
          data: {}
        })
      )
    })

    it('sends HTTP request with body', () => {
      const factory = new Factory()
      factory.new().post('http://example.com', { foo: 'bar' })
      expect(wx.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://example.com',
          method: 'POST',
          data: { foo: 'bar' },
          dataType: 'json'
        })
      )
    })

    it('sends a POST request with query string', () => {
      const factory = new Factory()
      factory
        .new()
        .withQuery({ greeting: 'world' })
        .post('http://example.com', { foo: 'bar' })
      expect(wx.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://example.com?greeting=world',
          method: 'POST',
          data: { foo: 'bar' }
        })
      )
    })

    it('uploads a file with POST request', () => {
      const factory = new Factory()
      factory.new().upload({
        url: 'http://example.com',
        filePath: '/tmp/foo.jpg',
        name: 'file'
      })
      expect(wx.uploadFile).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://example.com',
          filePath: '/tmp/foo.jpg',
          name: 'file',
          header: expect.objectContaining({
            'content-type': 'multipart/form-data'
          })
        })
      )
    })

    it('can customize HTTP header', () => {
      const factory = new Factory()
      factory.new().withHeader('X-Foo', 'bar').get('http://example.com')
      expect(wx.request).toHaveBeenCalledWith(
        expect.objectContaining({
          header: expect.objectContaining({
            'X-Foo': 'bar'
          })
        })
      )
    })

    it('can retrieve the request task', () => {
      ;(wx.request as jest.Mock).mockImplementationOnce(() => ({
        abort: jest.fn()
      }))
      const factory = new Factory()
      const { task } = factory.new().get('http://example.com')
      expect(task.abort).toBeDefined()
    })

    it('can retrieve the HTTP response', async () => {
      ;(wx.request as jest.Mock).mockImplementationOnce(({ success }) => {
        success({
          data: {},
          statusCode: 200,
          header: {},
          cookies: []
        })
        return { abort: jest.fn() }
      })
      const factory = new Factory()
      const response = await factory.new().get('http://example.com')
      expect(response).toBeInstanceOf(Response)
    })

    it.each([
      ['http://example.com', '/', 'http://example.com'],
      ['http://example.com/', '/', 'http://example.com'],
      ['http://example.com/', '', 'http://example.com'],
      ['http://example.com', '/api', 'http://example.com/api'],
      ['http://example.com', 'http://other.com', 'http://other.com'],
      ['http://example.com', 'https://other.com', 'https://other.com'],
      ['http://example.com', 'http://other.com/api', 'http://other.com/api']
    ])('can customize base url', (baseUrl, path, url) => {
      const factory = new Factory()
      factory.new().baseUrl(baseUrl).get(path)
      expect(wx.request).toHaveBeenCalledWith(expect.objectContaining({ url }))
    })

    test('the request builder is immutable', () => {
      const factory = new Factory()
      const request = factory.new()
      request.withHeader('X-Foo', 'bar')
      request.get('/')
      expect(wx.request).toHaveBeenCalledWith(
        expect.objectContaining({
          header: expect.not.objectContaining({
            'X-Foo': 'bar'
          })
        })
      )
    })

    it('sends HTTP request with HTML forms', () => {
      const factory = new Factory()
      factory.new().asForm().post('http://example.com', { foo: 'bar' })
      expect(wx.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { foo: 'bar' },
          header: expect.objectContaining({
            'content-type': 'application/x-www-form-urlencoded'
          })
        })
      )
    })

    it('can customize timeout in milliseconds', () => {
      const factory = new Factory()
      factory.new().timeout(5000).get('http://example.com')
      expect(wx.request).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 5000
        })
      )
    })

    describe('middleware', () => {
      it('should be applied', () => {
        const middleware = jest.fn((request, next) => next(request))
        const factory = new Factory()
        factory.new().use(middleware).get('http://example.com')
        expect(middleware).toHaveBeenCalled()
      })

      it('should be applied to the upload request', () => {
        const middleware = jest.fn((request, next) => next(request))
        const factory = new Factory()
        factory.new().use(middleware).upload({
          url: 'http://example.com',
          filePath: 'foo.jpg',
          name: 'file'
        })
        expect(middleware).toHaveBeenCalled()
      })

      it('can modify HTTP request', () => {
        const middleware = (request: any, next: any) =>
          next(request.withHeader('X-Foo', 'bar'))
        const factory = new Factory()
        factory.new().use(middleware).get('http://example.com')
        expect(wx.request).toHaveBeenCalledWith(
          expect.objectContaining({
            header: expect.objectContaining({ 'X-Foo': 'bar' })
          })
        )
      })

      it('can modify upload request', () => {
        const middleware = (request: any, next: any) =>
          next(request.withHeader('X-Foo', 'bar'))
        const factory = new Factory()
        factory.new().use(middleware).upload({
          url: 'http://example.com',
          filePath: 'foo.jpg',
          name: 'file'
        })
        expect(wx.uploadFile).toHaveBeenCalledWith(
          expect.objectContaining({
            header: expect.objectContaining({ 'X-Foo': 'bar' })
          })
        )
      })

      it('can retrieve HTTP response', () => {
        ;(wx.request as jest.Mock).mockImplementationOnce(({ success }) => {
          success({
            data: {},
            statusCode: 200,
            header: {},
            cookies: []
          })
          return { abort: jest.fn() }
        })
        const middleware = (request: any, next: any) => {
          return next(request.withHeader('X-Foo', 'bar')).then(
            (response: any) => {
              expect(response).toBeInstanceOf(Response)
            }
          )
        }
        const factory = new Factory()
        factory.new().use(middleware).get('http://example.com')
      })
    })
  })

  describe('Factory', () => {
    it('sets global base url', () => {
      const factory = new Factory()
      factory.baseUrl('http://example.com')
      factory.new().get('/')
      factory.new().get('/api')
      expect(wx.request).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'http://example.com' })
      )
      expect(wx.request).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'http://example.com/api' })
      )
    })

    it('crafts a JSON request by default', () => {
      const factory = new Factory()
      factory.baseUrl('http://example.com')
      factory.new().get('/')
      expect(wx.request).toHaveBeenCalledWith(
        expect.objectContaining({
          header: expect.objectContaining({
            'content-type': 'application/json'
          })
        })
      )
    })
  })
})
