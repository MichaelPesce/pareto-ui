import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { Paper, Grid, Box, Button, IconButton, Tooltip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import CompareIcon from '@mui/icons-material/Compare';
import { uploadExcelSheet, copyScenario } from '../../services/app.service'
import ErrorBar from '../../components/ErrorBar/ErrorBar'
import PopupModal from '../../components/PopupModal/PopupModal'
import FileUploadModal from '../../components/FileUploadModal/FileUploadModal'
import { useApp } from '../../AppContext';

export default function ScenarioList(props) {
    const { 
            handleNewScenario, 
            handleEditScenarioName, 
            handleSelection, 
            scenarios, 
            deleteScenario, 
            setScenarios, 
            setShowHeader, 
            setCompareScenarioIndexes,
            setScenarioIndex
        } = props
    const [ showError, setShowError ] = useState(false)
    const [ errorMessage, setErrorMessage ] = useState("")
    const [ openEditName, setOpenEditName ] = useState(false)
    const [ openDeleteModal, setOpenDeleteModal ] = useState(false)
    const [ showFileModal, setShowFileModal ] = useState(false)
    const [ hasOverrideList, setHasOverrideList ] = useState([])
    const [ name, setName ] = useState('')
    const [ id, setId ] = useState(null)
    let navigate = useNavigate();
    const { port } = useApp()
    const enabledStatusList = ['Optimized','Draft','failure', 'Not Optimized', 'Infeasible', 'Incomplete']
    const enabledStatusListCompare = ['Optimized']

    useEffect(()=> {
        setShowHeader(true)
    }, [props]) 

    useEffect(() => {
        let tempHasOverrideList = []
        for (let scenarioId of Object.keys(scenarios)) {
            let scenario = scenarios[scenarioId]
            if(scenario.results.status==="Optimized") {
                if (scenario.optimized_override_values !== undefined)  {
                    for(let key of Object.keys(scenario.optimized_override_values)) {
                        if(Object.keys(scenario.optimized_override_values[key]).length > 0) {
                            tempHasOverrideList.push(scenario.id)
                        }
                    }
                    
                }
            }
        }
        setHasOverrideList(tempHasOverrideList)
    },[scenarios])

    const handleOpenEditName = (name, id) => {
        setName(name)
        setId(id)
        setOpenEditName(true);
    }
    const handleCloseEditName = () => setOpenEditName(false);
    const handleCloseDeleteModal = () => setOpenDeleteModal(false);
    const handleOpenDeleteModal = (id) => {
        setOpenDeleteModal(true);
        setId(id)
    }

    const handleDelete = () => {
        deleteScenario(id)
        setOpenDeleteModal(false)
        setId(null)
    }

    const handleCopyScenario = (index) => {
        copyScenario(port, index, scenarios[index].name+' copy')
        .then(response => response.json())
        .then((data) => {
          setScenarios(data.scenarios)
          setId(data.new_id)
          setOpenEditName(true)
          setName(data.scenarios[data.new_id].name)
        }).catch(e => {
          console.error('error on scenario copy')
          console.error(e)
        })
    }

    const handleCompareScenario = (index) => {
        console.log('comparing scenario with index: '+index)
        setScenarioIndex(index)
        setCompareScenarioIndexes([index])
        navigate('/compare', {replace: true})
    }

    const handleEditName = (event) => {
        setName(event.target.value)
       }
    
    const handleSaveName = () => {
        handleEditScenarioName(name, id, false)
        setOpenEditName(false)
        setId(null)
    }

    const handleFileUpload = (file, name, model_type) => {
        if (!model_type) model_type = "strategic"
        const formData = new FormData();
        formData.append('file', file, file.name);

        uploadExcelSheet(port, formData, name, model_type)
        .then(response => {
        if (response.status === 200) {
            response.json()
            .then((data)=>{
                console.log('fileupload successful: ',data)
                handleNewScenario(data)
            }).catch((err)=>{
                console.error("error on file upload: ",err)
                setErrorMessage(String(err))
                setShowError(true)
            })
        }
        /*
            in the case of bad file type
        */
        else if (response.status === 400) {
            response.json()
            .then((data)=>{
                console.error("error on file upload: ",data.detail)
                setErrorMessage(data.detail)
                setShowError(true)
            }).catch((err)=>{
                console.error("error on file upload: ",err)
                setErrorMessage(response.statusText)
                setShowError(true)
            })
        }
        })
  }

  const styles={
    headerCell: {
        color: "white", 
        fontSize:"18px",
        fontWeight: "bold"
    },
    bodyCell: {
        color: "#0083b5", 
        fontSize:"16px",
        fontWeight: "bold"
    },
    newButton: {
        backgroundColor: '#0884b4',
        borderRadius: '8px', 
        '&:hover': {
            backgroundColor: '#0884b4',
            opacity: 0.9
        },
    },
}

  return (
    <Box sx={{m: 4}}>
    <Grid container>
        <Grid item xs={1}></Grid>
        <Grid item xs={5}>
            <Box sx={{display: 'flex', justifyContent: 'flex-start'}}>
                <h2 style={{color:"#003b60"}}>Scenarios</h2>
            </Box>
        </Grid>
        <Grid item xs={5}>
            <Box sx={{display: 'flex', justifyContent: 'flex-end'}}>
                <h2><Button variant="contained" sx={styles.newButton} component="label" onClick={() => setShowFileModal(true)}>
                    + Create New Scenario
                    </Button>
                </h2>
            </Box>
        </Grid>
        <Grid item xs={1}></Grid>
        <TableContainer component={Paper}>
        <Table sx={{ minWidth: 650 }} aria-label="simple table">
            <TableHead sx={{backgroundColor: "#6094bc", color: "white"}}>
            <TableRow key="headRow">
                <TableCell sx={styles.headerCell} style={{width:"20%"}}>Scenario Name</TableCell>
                <TableCell sx={styles.headerCell} align="center">Date Created</TableCell>
                <TableCell sx={styles.headerCell} align="center">Status</TableCell>
                <TableCell sx={styles.headerCell} align="center">Actions</TableCell>
            </TableRow>
            </TableHead>
            <TableBody>
            
            {Object.entries(scenarios).map( ([key, value] ) => {
                return( <TableRow
                hover
                key={key}
                sx={{ '&:last-child td, &:last-child th': { border: 0 } , cursor:"pointer"}}
                >
                <Tooltip title={hasOverrideList.includes(value.id) ? "Scenario has been optimized with manual override" : ""} placement="top" arrow>
                    <TableCell sx={styles.bodyCell} component="th" scope="row" onClick={() => handleSelection(key)}>
                        {value.name}
                        {hasOverrideList.includes(value.id) && <span style={{color: "red"}}> *</span>}
                    </TableCell>
                </Tooltip>
                <TableCell onClick={() => handleSelection(key)} sx={styles.bodyCell} align="center">{value.date}</TableCell>
                <TableCell onClick={() => handleSelection(key)} sx={styles.bodyCell} align="center">{value.results.status === "complete" ? "Optimized"  : value.results.status === "none" ? "Draft" : value.results.status}</TableCell>
                <TableCell sx={styles.bodyCell} align="center">
                    <Tooltip title="Edit Scenario Name" enterDelay={500}>
                        <IconButton onClick={() => handleOpenEditName(value.name, key)} disabled={enabledStatusList.includes(value.results.status) ? false : true}>
                            <EditIcon fontSize="small"/>
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Copy Scenario" enterDelay={500}>
                        <IconButton onClick={() => handleCopyScenario(key)} disabled={enabledStatusList.includes(value.results.status) ? false : true}>
                            <ContentCopyIcon fontSize="small"/>
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Scenario" enterDelay={500}>
                        <IconButton onClick={() => handleOpenDeleteModal(key)} disabled={enabledStatusList.includes(value.results.status) ? false : true}>
                            <DeleteIcon fontSize="small"/>
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Compare Scenario" enterDelay={500}>
                        <span>
                            <IconButton onClick={() => handleCompareScenario(key)} disabled={enabledStatusListCompare.includes(value.results.status) ? false : true}>
                                <CompareIcon fontSize="small"/>
                            </IconButton>
                        </span>
                        
                    </Tooltip>
                </TableCell>
                </TableRow>
                )
                
            })}
            </TableBody>
        </Table>
        </TableContainer>
        {showFileModal && 
        <FileUploadModal
            setShowFileModal={setShowFileModal}
            handleFileUpload={handleFileUpload}
        />
        }
        <PopupModal
            input
            open={openEditName}
            handleClose={handleCloseEditName}
            text={name}
            textLabel='Config Name'
            handleEditText={handleEditName}
            handleSave={handleSaveName}
            buttonText='Save'
            buttonColor='primary'
            buttonVariant='contained'
            width={400}
        />
        <PopupModal
            open={openDeleteModal}
            handleClose={handleCloseDeleteModal}
            text="Are you sure you want to delete this scenario?"
            handleSave={handleDelete}
            buttonText='Delete'
            buttonColor='error'
            buttonVariant='contained'
            width={400}
        />
        {
            showError && <ErrorBar duration={15000} setOpen={setShowError} severity="error" errorMessage={errorMessage} />
        }
        <Box sx={{display: 'flex', justifyContent: 'flex-start'}}>
        <h3 style={{color: '#0083b5'}}>PARETO documentation can be found <a href="https://pareto.readthedocs.io/en/stable/" target="_blank">here</a>.</h3>
        </Box>



    </Grid>
    </Box>
  );
}
