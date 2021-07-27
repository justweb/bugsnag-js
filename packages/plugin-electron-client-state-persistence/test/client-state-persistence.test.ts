import Client from '@bugsnag/core/client'
import { plugin } from '../'
import { Breadcrumb, Logger } from '@bugsnag/core'
import stateManager from '@bugsnag/plugin-electron-client-state-manager'

const filestore = {
  getEventInfoPath: jest.fn(),
  getPaths: () => ({
    lastRunInfo: ''
  })
}

const appRunMetadata = {
  bugsnag_crash_id: 'abc123'
}

describe('plugin: electron client sync', () => {
  it('updates context', done => {
    const c = new Client({
      apiKey: 'api_key',
      plugins: [
        stateManager,
        plugin({
          install: jest.fn(),
          updateContext: (update: any) => {
            expect(update).toBe('1234')
            done()
          }
        }, filestore, appRunMetadata)
      ]
    })
    c.setContext('1234')
  })

  it('updates metadata', done => {
    const c = new Client({
      apiKey: 'api_key',
      plugins: [
        stateManager,
        plugin({
          install: jest.fn(),
          updateMetadata: (key: string, updates: any) => {
            expect(key).toBe('widget')
            expect(updates).toEqual({
              id: '14',
              count: 340
            })
            done()
          }
        }, filestore, appRunMetadata)
      ]
    })
    c.addMetadata('widget', { id: '14', count: 340 })
    expect(c.getMetadata('widget')).toEqual({ id: '14', count: 340 })
  })

  it('clears metadata', done => {
    const c = new Client({
      apiKey: 'api_key',
      plugins: [
        stateManager,
        plugin({
          install: () => {},
          addMetadata: () => {},
          clearMetadata: () => {}
        }, filestore, appRunMetadata)
      ]
    })
    c.addMetadata('widget', { id: '14', count: 340 })
    expect(c.getMetadata('widget')).toEqual({ id: '14', count: 340 })
    c.clearMetadata('widget', 'count')
    expect(c.getMetadata('widget', 'count')).toBeUndefined()
    c.clearMetadata('widget')
    expect(c.getMetadata('widget')).toBeUndefined()
    done()
  })

  it('updates user', done => {
    const c = new Client({
      apiKey: 'api_key',
      plugins: [
        stateManager,
        plugin({
          install: jest.fn(),
          updateUser: (id: string, email: string, name: string) => {
            expect(id).toBe('1234')
            expect(name).toBe('Ben')
            expect(email).toBe('user@example.com')
            done()
          }
        }, filestore, appRunMetadata)
      ]
    })
    c.setUser('1234', 'user@example.com', 'Ben')
    expect(c.getUser()).toEqual({ id: '1234', name: 'Ben', email: 'user@example.com' })
  })

  it('syncs breadcrumbs', (done) => {
    const c = new Client({
      apiKey: 'api_key',
      plugins: [
        stateManager,
        plugin({
          install: jest.fn(),
          leaveBreadcrumb: ({ message, metadata, type, timestamp }: Breadcrumb) => {
            expect(message).toBe('Spin')
            expect(type).toBe('manual')
            expect(metadata).toEqual({ direction: 'ccw', deg: '90' })
            expect(timestamp).toBeTruthy()
            done()
          }
        }, filestore, appRunMetadata)
      ]
    })
    c.leaveBreadcrumb('Spin', { direction: 'ccw', deg: '90' })
  })

  it('does not sync breadcrumbs that are cancelled by an onBreadcrumb callback', () => {
    const NativeClient = { install: jest.fn(), leaveBreadcrumb: jest.fn() }

    const client = new Client({
      apiKey: 'api_key',
      plugins: [
        stateManager,
        plugin(NativeClient, filestore, appRunMetadata)
      ]
    })

    client.addOnBreadcrumb(breadcrumb => {
      if (breadcrumb.message === 'skip me') {
        return false
      }
    })

    // this onBreadcrumb is added last so it should always be called as it runs first
    const alwaysCalledOnBreadcrumb = jest.fn()
    client.addOnBreadcrumb(alwaysCalledOnBreadcrumb)

    client.leaveBreadcrumb('skip me')

    expect(alwaysCalledOnBreadcrumb).toHaveBeenCalled()
    expect(NativeClient.leaveBreadcrumb).not.toHaveBeenCalled()

    client.leaveBreadcrumb('this should be synced!')

    expect(alwaysCalledOnBreadcrumb).toHaveBeenCalled()
    expect(NativeClient.leaveBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({
      message: 'this should be synced!',
      metadata: {},
      type: 'manual'
    }))
  })

  function loggingClient (NativeClient: object): [Client, Logger] {
    const logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      error: jest.fn()
    }
    const filestore = {
      getEventInfoPath: () => '/tmp/event-info',
      getPaths: () => ({
        lastRunInfo: '/tmp/last-run-info.json'
      })
    }
    const appRunMetadata = {
      bugsnag_crash_id: 'abc123'
    }
    const client = new Client({
      apiKey: 'api_key',
      plugins: [stateManager, plugin(
        { install: jest.fn(), ...NativeClient }, filestore, appRunMetadata
      )],
      logger
    })
    return [client, logger]
  }

  it('logs errors thrown from updating context', () => {
    const [client, logger] = loggingClient({
      updateContext: () => {
        throw new Error('wrong thing')
      }
    })
    client.setContext('some invalid context')
    const error = logger.error as jest.Mock<Function>
    expect(error.mock.calls.length).toBe(1)
    expect(error.mock.calls[0][0].message).toContain('wrong thing')
  })

  it('logs errors thrown from adding breadcrumbs', () => {
    const [client, logger] = loggingClient({
      leaveBreadcrumb: () => {
        throw new Error('wrong thing')
      }
    })
    client.leaveBreadcrumb('Spin', { direction: 'ccw', deg: '90' })
    const error = logger.error as jest.Mock<Function>
    expect(error.mock.calls.length).toBe(1)
    expect(error.mock.calls[0][0].message).toContain('wrong thing')
  })

  it('logs errors thrown from adding metadata', () => {
    const [client, logger] = loggingClient({
      updateMetadata: () => {
        throw new Error('wrong thing')
      }
    })
    client.addMetadata('widget', { id: '14', count: 340 })
    const error = logger.error as jest.Mock<Function>
    expect(error.mock.calls.length).toBe(1)
    expect(error.mock.calls[0][0].message).toContain('wrong thing')
  })

  it('logs errors thrown from clearing metadata', () => {
    const [client, logger] = loggingClient({
      updateMetadata: () => {
        throw new Error('wrong thing')
      }
    })
    client.clearMetadata('widget')
    const error = logger.error as jest.Mock<Function>
    expect(error.mock.calls.length).toBe(1)
    expect(error.mock.calls[0][0].message).toContain('wrong thing')
  })

  it('logs errors thrown from updating user info', () => {
    const [client, logger] = loggingClient({
      updateUser: () => {
        throw new Error('wrong thing')
      }
    })
    client.setUser('404', 'tim@example.com', undefined)
    const error = logger.error as jest.Mock<Function>
    expect(error.mock.calls.length).toBe(1)
    expect(error.mock.calls[0][0].message).toContain('wrong thing')
  })

  it('installs NativeClient when loaded', () => {
    const NativeClient = { install: jest.fn(), leaveBreadcrumb: jest.fn() }

    // eslint-disable-next-line no-new
    new Client({
      apiKey: 'api_key',
      plugins: [
        stateManager,
        plugin(NativeClient, filestore, appRunMetadata)
      ]
    })

    expect(NativeClient.install).toBeCalledTimes(1)
  })
})
