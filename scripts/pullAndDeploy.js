const axios = require('axios')
const { ethers } = require('ethers')
const fs = require('fs/promises')
require('dotenv').config()
const { exec } = require('child_process')

// set whatever target address you might want here.
// even tho u could, plz dont use a sanctioned address, ok? proof of concept only
const yourAddress = '0x89E313A640Ba65a3c8C5De723947Ad6a45938FdF' // Found on etherscan
const apiKey = process.env.ETHERSCAN_API
const infura = process.env.RINKEBY_URL
const abiUrl = 'https://api-rinkeby.etherscan.io/api?module=contract&action=getabi&address='+yourAddress+'&apikey='+apiKey
const codeUrl = 'https://api-rinkeby.etherscan.io/api?module=contract&action=getsourcecode&address='+yourAddress+'&apikey='+apiKey

const getRepo = async () => {

    //fetch abi
    const abiResult = await axios.get(abiUrl)
    const abi = JSON.parse(abiResult.data.result)

    //fetch source code
    const codeResult = await axios.get(codeUrl)
    const code = codeResult.data.result
    const output = JSON.parse((code[0].SourceCode).toString().slice(1,-1))
    let sources = output.sources

    // create registry of OZ fileNames and dependencyFiles
    const shorthand = './node_modules/@openzeppelin/contracts/'
    let dirContent = await (fs.readdir(shorthand))

    let dependencyFiles = []    
    // quick enumeration of already installed dependency files    
    let iterate = async (content) => {
        while (content.length > 0) {
            let i = content.pop()
            if (i == 'README.md' || i == 'package.json') continue
            
            // collect solidity files from higher level directories
            let j = await fs.readdir(shorthand+i)
            let k = j.pop()
            if (k.endsWith('.sol')) {
                dependencyFiles.push(k.toString())
            }

            // collect solidity files from lowest level directories
            while (j.length > 0) {
                let l = j.pop()
                if(l.endsWith('.sol')) {
                    dependencyFiles.push(l.toString())
                } else {
                    let m = await fs.readdir(shorthand+i+'/'+l)
                    while (m.length > 0) {
                        let n = m.pop()
                        if (n.endsWith('.sol')) {
                            dependencyFiles.push(n.toString())
                        }
                    }
                }
            }
        }
    }

    await iterate(dirContent) 
    
    let files = []
    for (source in sources) {
        let elements = source.split('/')
        let file = elements.pop()

        let bool = dependencyFiles.includes(file)
        if (bool) { continue }
        else { files.push(file) }
    }

    // create solidity files
    let array = []
    let sourceCodes = output.sources
    for (source in sourceCodes) {
        array.push(sourceCodes[source].content)
        let fileName = files.pop()
        let fileContent = array.pop()
        const toWrite = await fs.writeFile('./contracts/'+fileName, fileContent)
    }
}

getRepo().then(() => {
    exec('npx hardhat run scripts/deploy.js')
})