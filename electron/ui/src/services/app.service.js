let BACKEND_URL = "http://localhost"

export const updateScenario = (backend_port, data) => {
    return fetch(BACKEND_URL+':'+backend_port+'/update', {
        method: 'POST', 
        mode: 'cors',
        body: JSON.stringify(data)
    });
}; 

export const updateExcel = (backend_port, data) => {
    return fetch(BACKEND_URL+':'+backend_port+'/update_excel', {
        method: 'POST', 
        mode: 'cors',
        body: JSON.stringify(data)
    });
}; 

export const fetchScenarios = (backend_port) => {
    return fetch(BACKEND_URL+':'+backend_port+'/get_scenario_list/', {
        method: 'GET', 
        mode: 'cors'
    });
}; 

export const checkTasks = (backend_port) => {
    return fetch(BACKEND_URL+':'+backend_port+'/check_tasks/', {
        method: 'GET', 
        mode: 'cors'
    });
}; 

export const fetchDiagram = (backend_port, type, id) => {
    return fetch(BACKEND_URL+':'+backend_port+'/get_diagram/'+type+'/'+id, {
        method: 'GET', 
        mode: 'cors'
    });
}

export const uploadDiagram = (backend_port, data, type, id) => {
    return fetch(BACKEND_URL+':'+backend_port+'/upload_diagram/'+type+'/'+id, {
        method: 'POST', 
        mode: 'cors',
        body: data
    });
}; 

export const deleteDiagram = (backend_port, type, id) => {
    return fetch(BACKEND_URL+':'+backend_port+'/delete_diagram/'+type+'/'+id, {
        method: 'GET', 
        mode: 'cors'
    });
}

export const fetchExcelTemplate = (backend_port, id) => {
    return fetch(BACKEND_URL+':'+backend_port+'/get_template/'+id, {
        method: 'GET', 
        mode: 'cors'
    });
}

export const replaceExcelSheet = (backend_port, data, id) => {
    return fetch(BACKEND_URL+':'+backend_port+'/replace/'+id, {
        method: 'POST', 
        mode: 'cors',
        body: data
    });
}; 

export const fetchExcelFile = (backend_port, filename) => {
    return fetch(BACKEND_URL+':'+backend_port+'/get_excel_file/'+filename, {
        method: 'GET', 
        mode: 'cors'
    });
}; 

export const runModel = (backend_port, data) => {
    return fetch(BACKEND_URL+':'+backend_port+'/run_model/', {
        method: 'POST', 
        mode: 'cors',
        body: JSON.stringify(data)
    });
}; 

export const deleteScenario = (backend_port, data) => {
    return fetch(BACKEND_URL+':'+backend_port+'/delete_scenario/', {
        method: 'POST', 
        mode: 'cors',
        body: JSON.stringify(data)
    });
}; 

export const copyScenario = (backend_port, id, newScenarioName) => {
    return fetch(BACKEND_URL+':'+backend_port+'/copy/'+id+'/'+newScenarioName, {
        method: 'GET', 
        mode: 'cors'
    });
};

export const uploadExcelSheet = (backend_port, data, name, model_type) => {
    if (!model_type) model_type = "strategic"
    return fetch(BACKEND_URL+':'+backend_port+'/upload/'+name+'/'+model_type, {
        method: 'POST', 
        mode: 'cors',
        body: data
    });
}; 
