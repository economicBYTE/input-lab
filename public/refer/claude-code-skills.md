                                                               /keybindings to customize

内置命令：
  /review                 Review a pull request                                                            
  /add-dir                Add a new working directory                                                        
  /agents                 Manage agent configurations                                                        
  /branch                 Create a branch of the current conversation at this point                          
  /btw                    Ask a quick side question without interrupting the main conversation               
  /chrome                 Claude in Chrome (Beta) settings  
  /clear                  Clear conversation history and free up context                                   
  /color                  Set the prompt bar color for this session                                          
  /compact                Clear conversation history but keep a summary in context. Optional: /compact [in…  
  /config                 Open config panel                                                                  
  /context                Visualize current context usage as a colored grid                                  
  /copy                   Copy Claude's last response to clipboard (or /copy N for the Nth-latest)      
  /desktop                Continue the current session in Claude Desktop                                   
  /diff                   View uncommitted changes and per-turn diffs                                        
  /doctor                 Diagnose and verify your Claude Code installation and settings                     
  /effort                 Set effort level for model usage                                                   
  /exit                   Exit the REPL                                                                      
  /export                 Export the current conversation to a file or clipboard           
  /exit                   Exit the REPL                                                                    
  /export                 Export the current conversation to a file or clipboard                             
  /extra-usage            Configure extra usage to keep working when limits are hit                          
  /fast                   Toggle fast mode (Opus 4.6 only)                                                   
  /feedback               Submit feedback about Claude Code                                                  
  /help                   Show help and available commands               
   /hooks                  View hook configurations for tool events                                         
  /ide                    Manage IDE integrations and show status                                            
  /install-github-app     Set up Claude GitHub Actions for a repository                                      
  /install-slack-app      Install the Claude Slack app                                                       
  /keybindings            Open or create your keybindings configuration file                                 
  /login                  Sign in with your Anthropic account             
  /logout                 Sign out from your Anthropic account                                             
  /mcp                    Manage MCP servers                                                                 
  /memory                 Edit Claude memory files                                                           
  /mobile                 Show QR code to download the Claude mobile app                                     
  /model                  Set the AI model for Claude Code (currently Opus 4.6)                              
  /permissions            Manage allow & deny tool permission rules                          
   /plan                   Enable plan mode or view the current session plan                                
  /plugin                 Manage Claude Code plugins                                                         
  /privacy-settings       View and update your privacy settings                                              
  /release-notes          View release notes                                                                 
  /reload-plugins         Activate pending plugin changes in the current session                             
  /remote-control         Connect this terminal for remote-control sessions     
  /remote-env             Configure the default remote environment for teleport sessions                   
  /rename                 Rename the current conversation                                                    
  /resume                 Resume a previous conversation                                                     
  /rewind                 Restore the code and/or conversation to a previous point                           
  /sandbox                ◯ sandbox disabled (⏎ to configure)                                                
  /skills                 List available skills                                 
   /stats                  Show your Claude Code usage statistics and activity                              
  /status                 Show Claude Code status including version, model, account, API connectivity, and…  
  /stickers               Order Claude Code stickers                                                         
  /tasks                  List and manage background tasks                                                   
  /terminal-setup         Install Shift+Enter key binding for newlines                                       
  /theme                  Change the theme                       
   /upgrade                Upgrade to Max for higher rate limits and more Opus                              
  /usage                  Show plan usage limits                                                             
  /vim                    Toggle between Vim and Normal editing modes                                        
  /voice                  Toggle voice mode                                                                  
  /web-setup              Setup Claude Code on the web (requires connecting your GitHub account)  
  /batch                  Research and plan a large-scale change, then execute it in parallel across 5–30 …
  /claude-api             Build apps with the Claude API or Anthropic SDK.                                   
  TRIGGER when: code imports `anth…                                                                          
  /debug                  Enable debug logging for this session and help diagnose issues (bundled)           
  /init                   Initialize a new CLAUDE.md file with codebase documentation                        
  /insights               Generate a report analyzing your Claude Code sessions                              
  /loop                   Run a prompt or slash command on a recurring interval (e.g. /loop 5m /foo, defau
  /pr-comments            Get comments from a GitHub pull request                                            
  /security-review        Complete a security review of the pending changes on the current branch            
  /simplify               Review changed code for reuse, quality, and efficiency, then fix any issues foun…  
  /statusline             Set up Claude Code's status line UI                                                
  /update-config          Use this skill to configure the Claude Code harness via settings.json. Automated

  /help output 
    Claude understands your codebase, makes edits with your permission, and executes commands — right from     
  your terminal.                                                                                             
                                                                                                             
  Shortcuts
  ! for bash mode           double tap esc to clear input        ctrl + shift + - to undo                    
  / for commands            shift + tab to auto-accept edits     ctrl + z to suspend                         
  @ for file paths          ctrl + o for verbose output          ctrl + v to paste images                    
  & for background          ctrl + t to toggle tasks             meta + p to switch model                    
  /btw for side question    shift + ⏎ for newline                ctrl + s to stash prompt                    
                                                                 ctrl + g to edit in $EDITOR                 
  