import { expectType } from 'tsd'
import { Client } from '../src'

interface User {
  name: string
}

;async () => {
  const response = await Client.new().get('http://example.com')
  expectType<WechatMiniprogram.RequestSuccessCallbackResult['data']>(
    response.data()
  )
}

;async () => {
  const response = await Client.new().get<User>('http://example.com')
  expectType<User>(response.data())
}

;async () => {
  const response = await Client.new().get<string>('http://example.com/string')
  expectType<string>(response.data())
}

;async () => {
  const response = await Client.new().upload({
    url: 'http://example.com',
    filePath: '/tmp/foo.txt',
    name: 'file'
  })
  expectType<string>(response.data())
}
