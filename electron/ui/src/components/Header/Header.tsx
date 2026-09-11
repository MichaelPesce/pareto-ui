import './Header.css';
import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import logo from "../../images/pareto-logo.png";
import { IconButton, Menu, MenuItem, FormControl, Select } from '@mui/material'
import { useScenario } from 'context/ScenarioContext';
import MenuIcon from '@mui/icons-material/Menu';
import AISettingsDialog from '../AISettingsDialog/AISettingsDialog';
 
export default function Header(): JSX.Element {  
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const {
    scenarios,
    scenarioIndex: index,
    handleScenarioSelection: handleSelection,
    navigateToScenarioList: navigateHome 
  } = useScenario();
  const location = useLocation();
  const showHeader = location?.pathname !== "/";

    const handleScenarioSelection = (event: any) => {
      handleSelection(event?.target?.value)
    }

    return (
      <>
      {showHeader && 
        <div id="Header">
        
        <div className="titlebar">
          <div style={{cursor:"pointer"}} onClick={() => navigateHome?.()}>
            <div id="pareto_logo">
              <img src={logo} alt="PARETO Logo"/>
            </div>
          </div>
        {location.pathname === "/scenario" &&
          <>
            <p style={{color:'#565656', fontSize: '20px', marginLeft:'75px'}}>Scenario</p>
            <FormControl sx={{ m: 1, minWidth: 200 }} size="small">
            <Select
              value={index === null || index === undefined ? "" : index}
              onChange={handleScenarioSelection}
              sx={{color:'#0b89b9', fontWeight: "bold"}}
            >
                {Object.entries(scenarios || {}).map( ([key, value] ) => {
                  return <MenuItem key={key} value={key}>{(value as any).name}</MenuItem>
                })}
            </Select>
            </FormControl>
            
          </>
        }
        {location.pathname.includes("compare") && index !== null && index !== undefined &&
        <>
          <div style={{fontSize:"20px", marginLeft:"20px", color:'#0b89b9', fontWeight: "bold"}}>
            Home / {(scenarios as any)[String(index)]?.name} / Compare Scenarios
          </div>
        </>
        
        }
        <IconButton aria-label="Open app menu" aria-haspopup="menu"
          aria-controls={menuAnchor ? 'app-menu' : undefined} aria-expanded={Boolean(menuAnchor)}
          onClick={event => setMenuAnchor(event.currentTarget)} sx={{ml: 'auto', mr: 1, color: '#565656'}}>
          <MenuIcon />
        </IconButton>
        <Menu id="app-menu" anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}
          anchorOrigin={{vertical: 'bottom', horizontal: 'right'}} transformOrigin={{vertical: 'top', horizontal: 'right'}}>
          <MenuItem onClick={() => { setMenuAnchor(null); navigateHome?.(); }}>View scenario list</MenuItem>
          <MenuItem onClick={() => { setMenuAnchor(null); setSettingsOpen(true); }}>Settings</MenuItem>
        </Menu>
        </div>
      </div>
        }
        {settingsOpen && <AISettingsDialog onClose={() => setSettingsOpen(false)} />}
        </>
      
    );
  
}
