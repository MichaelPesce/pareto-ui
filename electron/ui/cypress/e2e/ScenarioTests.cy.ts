/// <reference types="cypress" />

describe('scenario testing', () => {
    let strategic_toy_case_study_url = "https://github.com/project-pareto/project-pareto/raw/main/pareto/case_studies/strategic_toy_case_study.xlsx"
    let workshopFileUrl = "https://github.com/project-pareto/project-pareto/raw/main/pareto/case_studies/workshop_baseline_all_data.xlsx"
    it('tests that scenario list loads properly', () => {
        //load webpage
        cy.visit('/#/scenarios')

        cy.screenshot(`loaded scenario list`)

        //locate header logo
        cy.findByRole('img', { name: /pareto logo/i })

        //locate heading
        cy.findByRole('heading', {  name: /scenarios/i})

        //locate new scenario button
        cy.findByRole('button', { name: /create new scenario/i})

        //locate table headers
        cy.findByRole('columnheader', {  name: /scenario name/i})
        cy.findByRole('columnheader', {  name: /date created/i})
        cy.findByRole('columnheader', {  name: /status/i})
        cy.findByRole('columnheader', {  name: /actions/i})
        
        cy.screenshot(`end scenario list`)
        
    })

    it('download strategic toy case study', () => {
        cy.downloadFile(workshopFileUrl,'cypress/downloads','strategic_toy_case_study.xlsx')
    })

    it('creates a new scenario by uploading excel sheet', () => {
        //load webpage
        cy.visit('/#/scenarios')
        cy.screenshot(`loaded homepage`)
        

        //click create new scenario
        cy.findByRole('button', {name: /\+ create new scenario/i}).click()
        cy.screenshot(`clicked create new scenario`)
        

        //download sample excel sheet
        cy.window().document().then(function (doc) {
            doc.addEventListener('click', () => {
              // reloads after 12 seconds from clicking the download button
              setTimeout(function () { doc.location.reload() }, 12000)
            })
            cy.get("[data-cy=excel-download").click()
          })
        cy.screenshot(`downloaded excel sheet`)
        
        // cy.visit('/#/scenarios')
        cy.wait(12000)

        //create scenario with name cypress test, using sample excel sheet
        cy.findByRole('button', {name: /\+ create new scenario/i}).click()
        cy.screenshot(`clicked create new scenario`)
        
        cy.findByRole('textbox').type('cypress test')
        cy.get('input[type=file]').selectFile('./cypress/downloads/strategic_toy_case_study.xlsx', {
            action: 'drag-drop',
            force: true
          })
        cy.screenshot(`uploaded excel`)
        
        cy.intercept({
            method: "POST",
            url: "http://localhost:50011/**",
        }).as("createScenario");
        // cy.findByRole('button', {name: /create scenario/i}).click()
        cy.get('button[id="create-scenario-button"]').click()
        cy.wait("@createScenario");
        cy.screenshot(`clicked create scenario`)
        

        //ensure that it reached the correct page
        cy.contains(/data input/i).should('be.visible')
        cy.contains(/optimization setup/i).should('be.visible')
        cy.contains(/model results/i).should('be.visible')
        cy.contains(/plots/i).should('be.visible')
        cy.contains(/network diagram/i).should('be.visible')

        cy.screenshot(`finished creating scenario`)
        
    })

    

    it('copies existing scenario', () => {
        //load webpage
        cy.visit('/#/scenarios')
        cy.wait(2000)
        cy.screenshot(`loaded homepage`)
        

        //count the amount of scenarios
        let scenarioListLength
        cy.findAllByRole('button', {  name: /copy scenario/i}).then((value) => {
            scenarioListLength = Cypress.$(value).length;
        })

        //copy scenario and save
        cy.findAllByRole('button', {  name: /copy scenario/i}).eq(-1).click()
        cy.contains(/save/i).click()
        cy.wait(1000)
        cy.screenshot(`copied scenario`)
        

        //validate results
        cy.contains(/copy/i).should('be.visible')
        cy.findAllByRole('button', {  name: /copy scenario/i}).then((value) => {
            expect(value).to.have.length(scenarioListLength + 1);
        })
    })

    it('deletes existing scenario', () => {
        //load webpage
        cy.visit('/#/scenarios')
        cy.wait(2000)
        cy.screenshot(`loaded homepage`)
        

        //count the amount of scenarios
        let scenarioListLength
        cy.findAllByRole('button', {  name: /copy scenario/i}).then((value) => {
            scenarioListLength = Cypress.$(value).length;
        })

        //delete scenario and click confirm delete
        cy.findAllByRole('button', {  name: /delete scenario/i}).eq(-1).click()
        cy.wait(1000)
        cy.screenshot(`clicked delete scenario`)
        
        cy.findByRole('button', {name: /delete/i}).click()
        cy.wait(5000)
        cy.screenshot(`deleted scenario`)
        

        //validate results
        cy.findAllByRole('button', {  name: /copy scenario/i}).then((value) => {
            expect(value).to.have.length(scenarioListLength - 1);
        })
    })

    it('runs an optimization and validates model results', () => {
        //load webpage
        cy.visit('/#/scenarios')
        cy.wait(2000)
        cy.screenshot(`loaded homepage`)

        //load scnenario
        cy.contains(/cypress test/i).click()
        cy.wait(2000)
        cy.screenshot(`clicked on scenario`)
        

        //run optimization with default settings
        cy.findByRole('button', {name: /continue to optimization/i}).click()
        cy.screenshot(`optimization settings`)
        
        // Validation can take longer than the default command timeout on Windows.
        // Match the canonical endpoint after FastAPI's trailing-slash redirect.
        cy.intercept('POST', /\/run_model$/).as('startOptimization')
        cy.findAllByRole('button', {name: /optimize/i}).eq(0).click()

        cy.wait('@startOptimization', {responseTimeout: 120000})
            .its('response.statusCode').should('eq', 200)
        // A fast solve may skip the loading screen. Require the actual results,
        // retaining the existing 20-minute budget for the default 15-minute solve.
        cy.contains(/recycling rate/i, {timeout: 1200000}).should('be.visible')
        cy.screenshot(`finished optimizing`)
        
        //validate results
        cy.contains(/total disposal/i).should('be.visible')
        cy.contains(/sourced water/i).should('be.visible')
        cy.contains(/capex/i).should('be.visible')
        cy.contains(/opex/i).should('be.visible')
    })
})
