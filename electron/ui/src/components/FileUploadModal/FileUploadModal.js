import React from 'react';
import {useState, useEffect} from 'react';   
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Modal from '@mui/material/Modal';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Button from '@mui/material/Button';
import { FileUploader } from "react-drag-drop-files";
import { fetchExcelFile } from '../../services/app.service';
import { useApp } from '../../AppContext';



export default function FileUploadModal(props) {
    const [ scenarioName, setScenarioName ] = useState("")
    const [ showWarning, setShowWarning ] = useState(false)
    const [ warningMessage, setWarningMessage ] = useState("")
    const [ modelType, setModelType ] = useState("strategic")
    const [ file, setFile ] = useState(null)
    const fileTypes = ["xlsx", "kmz", "kml"];
    const PARETO_VERSION = "main"

    const sampleFileUrl = "https://github.com/project-pareto/project-pareto/raw/"+process.env.REACT_APP_PARETO_VERSION+"/pareto/case_studies/strategic_permian_demo.xlsx"
    const workshopFileUrl = "https://github.com/project-pareto/project-pareto/raw/"+process.env.REACT_APP_PARETO_VERSION+"/pareto/case_studies/workshop_baseline_all_data.xlsx"
    const workshopFileName = "workshop_baseline_all_data_"+process.env.REACT_APP_PARETO_VERSION+".xlsx"

  const { port } = useApp()


   const styles = {
    modalStyle: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: 600,
      bgcolor: 'background.paper',
      border: '1px solid #AEAEAE',
      borderRadius:2,
      boxShadow: 24,
      p: 2,
    },
    header:{
        color:"#0884b4",
        marginTop:5
    },
    button: {
        backgroundColor: '#0884b4',
        borderRadius: '8px', 
        color:'white',
        width: 200,
        '&:hover': {
            backgroundColor: '#0884b4',
            opacity: 0.9
        },
    },
    sampleFile:{
        color:"#0884b4",
        textDecoration: "none",
        fontWeight: "bold",
        cursor: 'pointer'
    },
    fileUploaderBox: {
        border: '2px dashed black',
        borderRadius:2,
        p:10,
        cursor: "pointer"
    }
   }

   const handleEditScenarioName = (event) => {
    setScenarioName(event.target.value)
   }

   const handleClose = () => {
    props.setShowFileModal(false)
   }

   const handleDownloadWorkshopFile = () => {
        fetchExcelFile(port, workshopFileName).then(response => {
        if (response.status === 200) {
                response.blob().then((data)=>{
                let excelURL = window.URL.createObjectURL(data);
                let tempLink = document.createElement('a');
                tempLink.href = excelURL;
                tempLink.setAttribute('download', 'workshop_baseline_all_data.xlsx');
                tempLink.click();
            }).catch((err)=>{
                console.error("error fetching excel template path: ",err)
            })
        }
        else {
            console.error("error fetching excel template path: ",response.statusText)
        }
        })
   }

   const handleCreateScenario = () => {
    if (file === null) {
        setWarningMessage("Please upload a valid file")
        setShowWarning(true)
        setTimeout(function() {
            setShowWarning(false)
          }, 5000)
    } else if (scenarioName === "") {
        setWarningMessage("Please provide a name for new scenario")
        setShowWarning(true)
        setTimeout(function() {
            setShowWarning(false)
          }, 5000)
    }else {
        props.handleFileUpload(file, scenarioName, modelType)
        setShowWarning(false)
        props.setShowFileModal(false)
    }
   }

   const fileTypeError = () => {
        setWarningMessage("Please choose a valid excel file")
        setShowWarning(true)
        setTimeout(function() {
            setShowWarning(false)
          }, 5000)
   }

   const fileUploaderContainer = () => {
    return (
        <Box sx={styles.fileUploaderBox}>
            <Box sx={{display: 'flex', justifyContent: 'center'}}>
                <h2 style={{marginTop:0, paddingTop:0, color:"#9B9B9B"}}>Drag and Drop File</h2>
            </Box>
            <Box sx={{display: 'flex', justifyContent: 'center'}}>
                <h2 style={{marginTop:0, paddingTop:0, color:"#9B9B9B"}}>or</h2>
            </Box>
            <Box sx={{display: 'flex', justifyContent: 'center'}}>
                <Button style={{color: '#0884b4',}} variant="outlined">Browse...</Button>
            </Box>
            <Box sx={{display: 'flex', justifyContent: 'center'}}>
                <p style={{marginBottom:0, paddingTop:0}}>{file === null ? "" : file.name}</p>
            </Box>
        </Box>
    )
   }

   function DragDrop() {
    const handleChange = (file) => {
        console.log('setting file: '+file.name)
        if (file.name.toLowerCase().includes("operational")) {
            console.log("setting model type to operational")
            setModelType("operational")
        }
      setFile(file);
    };
    return (
      <FileUploader 
        handleChange={handleChange} 
        name="file" 
        types={fileTypes}
        children={fileUploaderContainer()}
        onTypeError={fileTypeError}
      />
    );
  }


  return (
      <Modal
          open={true}
          onClose={handleClose}
          aria-labelledby="modal-modal-title"
          aria-describedby="modal-modal-description"
      >

        <Grid container sx={styles.modalStyle} spacing={1}>
                    
        <Grid item xs={9}>
            <h2 style={styles.header}>Create a New Scenario</h2>
        </Grid>
        <Grid item xs={3}>
            <Box sx={{display: 'flex', justifyContent: 'flex-end', marginRight:'10px'}}>
                <IconButton onClick={handleClose}><CloseIcon/></IconButton>
            </Box>
        </Grid>

        {/* <Divider key={"divider_guy"}></Divider> */}
        <Grid item xs={12}>
            <TextField
                required
                variant="outlined"
                id=""
                label={"Scenario Name"}
                value={scenarioName}
                onChange={handleEditScenarioName}
                fullWidth
            />
        </Grid>

        <Grid item xs={12}>
            <p style={{color:"#666666"}}>Input file</p>
        </Grid>
        <Grid item xs={12}>
            {DragDrop()}
        </Grid>
        <Grid item xs={6}>
            <p><a data-cy="excel-download" style={styles.sampleFile} href={sampleFileUrl} download>Download an Example Input File</a></p>
            <p><a style={styles.sampleFile} href={workshopFileUrl} download>Download Workshop Input File</a></p>
            {/* <p style={styles.sampleFile} onClick={handleDownloadWorkshopFile} download>Download Workshop Input File</p> */}
        </Grid>
        <Grid item xs={6}>
            {showWarning && <p style={{color:'red', }}>{warningMessage}</p>}
        </Grid>
        {/* <Grid item xs={6}>
            <p ><a data-cy="excel-download" style={styles.sampleFile} href={workshopFileUrl} download>Download Workshop Input File</a></p>
        </Grid>
        <Grid item xs={6}></Grid> */}
        <Grid item xs={12}>
            <Button id="create-scenario-button" style={styles.button} onClick={handleCreateScenario}>Create Scenario</Button>
        </Grid>
        </Grid>
    </Modal>
  );

}


