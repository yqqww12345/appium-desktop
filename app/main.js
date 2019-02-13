import i18n from './configs/i18next.config';
import config from './configs/app.config';
import { app, BrowserWindow, Menu, webContents } from 'electron';
import { initializeIpc } from './main/appium';
import { setSavedEnv } from './main/helpers';
import rebuildMenus from './main/menus';
import shellEnv from 'shell-env';
import fixPath from 'fix-path';
import { initSentry } from './shared/sentry';
import { promptUser } from './main/sentry-permission-prompt';

let mainWindow = null;
const isDev = process.env.NODE_ENV === 'development';

if (isDev) {
  require('electron-debug')(); // eslint-disable-line global-require
}

if (!isDev) {
  // if we're running from the app package, we won't have access to env vars
  // normally loaded in a shell, so work around with the shell-env module
  const decoratedEnv = shellEnv.sync();
  process.env = {...process.env, ...decoratedEnv};

  // and we need to do the same thing with PATH
  fixPath();
}
setSavedEnv();

// Enable Sentry crash report logging
initSentry();

app.on('window-all-closed', () => {
  app.quit();
});


const installExtensions = async () => {
  if (isDev) {
    const installer = require('electron-devtools-installer'); // eslint-disable-line global-require
    const extensions = [
      'REACT_DEVELOPER_TOOLS',
      'REDUX_DEVTOOLS'
    ];
    const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
    for (const name of extensions) {
      try {
        await installer.default(installer[name], forceDownload);
      } catch (e) {} // eslint-disable-line
    }
  }
};

app.on('ready', async () => {
  await installExtensions();

  mainWindow = new BrowserWindow({
    show: false,
    width: isDev ? 1200 : 650,
    height: 600,
    minWidth: 650,
    minHeight: 600,
  });

  mainWindow.loadURL(`file://${__dirname}/index.html`);

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (isDev) {
    mainWindow.openDevTools();
  }

  mainWindow.webContents.on('context-menu', (e, props) => {
    const {x, y} = props;

    Menu.buildFromTemplate([{
      label: i18n.t('Inspect element'),
      click () {
        mainWindow.inspectElement(x, y);
      }
    }]).popup(mainWindow);
  });

  i18n.on('languageChanged', (languageCode) => {
    rebuildMenus();
    webContents.getAllWebContents().forEach((wc) => {
      wc.send('appium-language-changed', {
        language: languageCode,
        namespace: config.namespace,
        resource: i18n.getResourceBundle(languageCode, config.namespace)
      });
    });
  });

  rebuildMenus(mainWindow);

  promptUser();

  initializeIpc(mainWindow);
});
