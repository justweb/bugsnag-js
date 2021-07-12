module.exports = class BugsnagPluginReactNativeNavigation {
  constructor (Navigation) {
    if (!Navigation) {
      throw new Error(
        '@bugsnag/plugin-react-native-navigation reference to `Navigation` was undefined'
      )
    }

    this.Navigation = Navigation
  }

  load (client) {
    client.addMetadata('debugging (on load)', {
      time: (new Date()).toString(),
      enabledBreadcrumbTypes: client._config.enabledBreadcrumbTypes,
    })

    let lastComponent

    this.Navigation.events().registerComponentDidAppearListener(event => {
      client.addMetadata('debugging (registerComponentDidAppearListener)', {
        time: (new Date()).toString(),
        lastComponent,
        currentComponent: event.componentName,
        enabledBreadcrumbTypes: client._config.enabledBreadcrumbTypes,
        isBreadcrumbTypeEnabled: client._isBreadcrumbTypeEnabled('navigation')
      })

      client.setContext(event.componentName)

      if (lastComponent !== event.componentName && client._isBreadcrumbTypeEnabled('navigation')) {
        client.addMetadata('debugging (registerComponentDidAppearListener)', 'leftBreadcrumb', true)

        client.leaveBreadcrumb(
          'React Native Navigation componentDidAppear',
          { to: event.componentName, from: lastComponent },
          'navigation'
        )
      }

      lastComponent = event.componentName
    })
  }
}
