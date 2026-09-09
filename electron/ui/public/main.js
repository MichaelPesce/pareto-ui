const { app, BrowserWindow, protocol, ipcMain, safeStorage } = require('electron')
const log = require('electron-log');
const Store = require("electron-store")
const storage = new Store();

log.transports.file.resolvePath = () => path.join(__dirname, '/logsmain.log');
log.transports.file.level = "info";

exports.log = (entry) => log.info(entry)

const path = require('path')
const { fileURLToPath } = require('url');
const { createAISettings } = require('./ai-settings');
require('dotenv').config()

const axios = require('axios').default;
const isDev = require('electron-is-dev')
const { spawn, execFile } = require("child_process")

// Python server parameters
const PY_HOST = "127.0.0.1";
const PY_PORT = 50011;
const UI_PORT = 3000;
const PY_LOG_LEVEL = "info";
let uiReady = false

const serverURL = `http://localhost:${PY_PORT}`
const uiURL = `http://localhost:${UI_PORT}`

require('@electron/remote/main').initialize()

// custom log function to make sure we log everything to console and file
function _log (message) {
  log.info(message);
  console.log(message);
}

function getWindowSettings () {
  const default_bounds = [800, 600]

  const size = storage.get('win-size');

  if (size) return size;
  else {
    storage.set("win-size", default_bounds);
    return default_bounds;
  }
}

function saveBounds (bounds) {
  storage.set("win-size", bounds)
}


function createWindow() {
  
  const bounds = getWindowSettings();
  _log('bounds:',bounds)

  // Create the browser window.
  const win = new BrowserWindow({
    width: bounds[0],
    height: bounds[1],
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: true,
      webSecurity: true,
    }
  })
  if (isDev) {
    win.webContents.openDevTools()
  } 
  var handleRedirect = (e, url) => {
    if(url != win.webContents.getURL()) {
      e.preventDefault()
      require('electron').shell.openExternal(url)
    }
  }
  win.webContents.on('will-navigate', handleRedirect)
  win.webContents.on('new-window', handleRedirect)
  _log("storing user preferences in: ",app.getPath('userData'));

  // save size of window when resized
  win.on("resized", () => saveBounds(win.getSize()));

  win.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`
  )

  return win
}

const installExtensions = () => {
    try{
    installationProcess = spawn(
      path.join(__dirname, "../py_dist/main/main"),
      [
        "install"
      ]
    );

    _log("installation started")

      var scriptOutput = "";
      installationProcess.stdout.setEncoding('utf8');
      installationProcess.stdout.on('data', function(data) {
          _log('stdout: ' + data);
          data=data.toString();
          scriptOutput+=data;
      });

      installationProcess.stderr.setEncoding('utf8');
      installationProcess.stderr.on('data', function(data) {
          _log('stderr: ' + data);
          data=data.toString();
          scriptOutput+=data;
      });
    } catch (error) {
      _log("unable to get extensions: ",error);
      console.error("unable to get extensions: ",error);
    }
    return installationProcess;
  }
  

const startServer = () => {
    if (isDev) {

      backendProcess = spawn("uvicorn", 
        [
            "main:app",
            "--reload",
            "--host",
            "127.0.0.1",
            "--port",
            PY_PORT,
        ],
        {
            cwd: '../backend/app'
        }
      );

    } else {
      try {
        backendProcess = spawn(
          path.join(__dirname, "../py_dist/main/main"),
          [
            ""
          ]
        );
        var scriptOutput = "";
        backendProcess.stdout.setEncoding('utf8');
        backendProcess.stdout.on('data', function(data) {
            _log('stdout: ' + data);
            data=data.toString();
            scriptOutput+=data;
        });

        backendProcess.stderr.setEncoding('utf8');
        backendProcess.stderr.on('data', function(data) {
            _log('stderr: ' + data);
            data=data.toString();
            scriptOutput+=data;
        });
        _log("Python process started in built mode");
      } catch (error) {
        _log("unable to start python process in build mode: ");
        _log(error)
        console.error("unable to start python process in build mode: ");
        console.error(error)
      }
      
    }
    return backendProcess;
}


app.whenReady().then(() => {
    const aiSettings = createAISettings({storage, safeStorage, request: async (method, data) => {
      try {
        const response = await axios({method, data, url: `http://${PY_HOST}:${PY_PORT}/ai_settings`, timeout: 10000});
        return response.data;
      } catch (error) {
        const detail = error.response?.data?.detail;
        const failure = new Error(typeof detail === 'string' ? detail : 'Unable to reach AI settings. Check that the app backend is running.');
        failure.retryable = !error.response;
        throw failure;
      }
    }});
    for (const operation of ['get', 'save', 'reset']) {
      ipcMain.handle(`ai-settings:${operation}`, async (event, input) => {
        const frame = event.senderFrame;
        const win = BrowserWindow.fromWebContents(event.sender);
        let trusted = false;
        try {
          const url = new URL(frame.url);
          trusted = Boolean(win && frame === event.sender.mainFrame && (isDev
            ? url.origin === uiURL
            : url.protocol === 'file:' && fileURLToPath(url) === path.join(__dirname, 'index.html')));
        } catch {}
        if (!trusted) return {ok: false, error: 'Settings are only available from the app window.'};
        try {
          return {ok: true, settings: await aiSettings(operation, input)};
        } catch (error) {
          return {ok: false, error: error.message || 'Unable to update AI settings.', retryable: error.retryable === true};
        }
      });
    }
    // Entry point
    if (isDev) {
      createWindow();
    } else {
      let win = createWindow();
      let serverProcess
      // let installationProcess = installExtensions()
      // installationProcess.on('exit', code => {
      //   _log('installation exit code is', code)
      _log('starting server')
      serverProcess = startServer()

      // let uiProcess = startUI()
      let noTrials = 0
      // Start Window 
      var startUp = (url, appName, spawnedProcess, successFn=null, maxTrials=25) => {
          
          axios.get(url).then(() => {
              _log(`${appName} is ready at ${url}!`)
          })
          .catch(async () => {
              _log(`Waiting to be able to connect ${appName} at ${url}...`)
              await new Promise(resolve => setTimeout(resolve, 10000))
              noTrials += 1
              if (noTrials < maxTrials) {
                  startUp(url, appName, spawnedProcess, successFn, maxTrials)
              }
              else {
                  _log(`Exceeded maximum trials to connect to ${appName}`)
                  // spawnedProcess.kill('SIGINT')
                  // win.close()
              }
          });
      };
      startUp(serverURL, 'FastAPI Server', serverProcess)
      app.on('quit', () => {
        _log('shutting down backend server')
        serverProcess.kill()
      })
      // })
    }

    
    

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })


})

// For windows & linux platforms
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})
