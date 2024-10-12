# Moduler

![License](https://img.shields.io/badge/license-ISC-brightgreen)

Ver la [versión en español](README.es.md)

**SIO-Moduler** is a package for Node.js that allows you to expose any package from `node_modules` and acts as middleware in Express applications. This is useful for facilitating the import of modules in the browser.

SIO-Moduler uses the exports property of packages to generate the routes that will be used; if this property does not exist, it generates them using the module or main property; finally, if none of these exist, it looks for the existence of the "index.js" file in the project.

## Installation

You can install SIO-Moduler via npm:

```bash
npm install sio-moduler
```

## Usage

Once installed, you can use Moduler in your Express application like this:

```javascript
import express from 'express';
import moduler from 'sio-moduler';

const app = express();
const modules = ['module-name']; // Replace with the modules you want to expose

// Use SIO-Moduler middleware
app.use('/modules', moduler(modules));

// Start the server
app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Importing Modules from the Browser

Once you have set up your server, you can import your modules directly from the browser using `<script>` tags. For example, if you exposed a module named `module-name`, you can import it like this:

```html
<script type="module">
  import { something } from '/modules/module-name';
  
  // Use 'something' in your code
  something();
</script>
```

### Features

- **Module Import:** SIO-Moduler redefines the import paths for files being imported from `node_modules`, making them accessible from the browser.
  
- **Dependency Support:** SIO-Moduler also manages your module dependencies and makes them accessible automatically.
  
- **Dynamic Routes:** Routes are configured dynamically based on the export structure of the packages, facilitating their use.

## Keywords

- node_modules  
- public  
- browser  
- middleware  
- express

## Contribution

If you wish to contribute to SIO-Moduler, please submit a pull request or open an issue.

## Author

**Siorbita:** Adrián Mercado Martínez

## License

This project is licensed under the ISC license. For more details, please see the LICENSE file.