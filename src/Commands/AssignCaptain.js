const BaseCommand = require('../Classes/BaseCommand.js')
const Logger = require('../util/Logger.js')

const heroesloungeApi = require('heroeslounge-api')
const { defaultServer } = require('../config.json')

class AssignCaptain extends BaseCommand {
  constructor (bot) {
    const permissions = {
      'Test-Server': {
        channels: ['robotchannel'],
        roles: ['Admin'],
        users: ['108153813143126016']
      }
    }

    const options = {
      prefix: '!',
      command: 'assigncaptain',
      aliases: [],
      description: 'Assigns the Captain role to all the captains of participating teams.',
      syntax: 'assigncaptain',
      ignoreInHelp: true
    }

    super(permissions, options)
    this.bot = bot
  }

  exec (msg) {
    syncCaptains(this.bot).then((response) => {
      this.bot.getDMChannel(msg.author.id).then((channel) => {
        return channel.createMessage(`Updated captains: ${response.updatedCaptainCounter}\nErrors:\n${response.errorMessage}`)
      }).catch((error) => {
        Logger.warn(`Could not notify about captain syncing`, error)
      })
    }).catch((error) => {
      Logger.error('Unable to sync captains', error)
    })
  }
}

let syncCaptains = (bot) => {
  Logger.info('Synchronising captain roles')

  return getParticipatingTeams().then((teams) => {
    let teamsWithDetails = []

    for (let team of teams) {
      const teamDetails = new Promise((resolve, reject) => {
        heroesloungeApi.getTeamSloths(team.id).then((sloths) => {
          let fullTeam = team
          fullTeam['sloths'] = sloths
          resolve(fullTeam)
        }).catch((error) => {
          Logger.warn(`Unable to get team sloths for team ${team.title}`, error)
          let fullTeam = team
          fullTeam['sloths'] = []
          resolve(fullTeam)
        })
      })

      teamsWithDetails = [...teamsWithDetails, teamDetails]
    }
    return Promise.all(teamsWithDetails)
  }).then((teamsWithDetails) => {
    let errorMessage = ''
    let syncedSloths = []

    const guild = bot.guilds.get(defaultServer)
    const captainRole = guild.roles.find((role) => {
      return role.name === 'Captains'
    })

    for (let team of teamsWithDetails) {
      if (team.sloths && team.sloths.length > 0 && team.disbanded === '0') {
        if (team.sloths[0].is_captain === '1') {
          if (team.sloths[0].discord_id.length > 0) {
            let captainSloth = team.sloths[0]

            const member = guild.members.get(captainSloth.discord_id)
            if (member) {
              if (member.roles.includes(captainRole.id)) continue

              syncedSloths.push(
                bot.addGuildMemberRole(defaultServer, captainSloth.discord_id, captainRole.id).catch((error) => {
                  Logger.warn(`Unable to assign captain for team ${team.title} user ${captainSloth.title}`, error)
                  errorMessage += `Unable to assign captain for team ${team.title} user ${captainSloth.title}\n`
                })
              )
            } else {
              errorMessage += `Captain not on discord for ${team.title} member ${captainSloth.title}\n`
            }
          } else {
            errorMessage += `No discord id for ${team.sloths[0].title} from ${team.title}\n`
          }
        } else {
          errorMessage += `No captain for ${team.title}\n`
        }
      } else {
        errorMessage += `No sloths for ${team.title}\n`
      }
    }

    return Promise.all(syncedSloths).then(() => {
      Logger.info(`Captain role synchronisation complete, updated ${syncedSloths.length} users`)
      return {
        'updatedCaptainCounter': syncedSloths.length,
        'errorMessage': errorMessage
      }
    })
  }).catch((error) => {
    throw error
  })
}

let getParticipatingTeams = async () => {
  const seasons = await heroesloungeApi.getSeasons().catch((error) => {
    throw error
  })

  let teamsByRegion = []
  let seasonCounter = 0

  for (let i = seasons.length - 1; i >= 0; i--) {
    if (seasonCounter >= 2) break
    if (seasons[i].type === '2') continue // Ignore Division S seasons

    if (seasons[i].is_active === '1' && seasons[i].reg_open === '0') {
      teamsByRegion = [...teamsByRegion, heroesloungeApi.getSeasonTeams(seasons[i].id)]
      seasonCounter++
    } else if (seasons[i].is_active === '1' && seasons[i].reg_open === '1') {
      seasonCounter++
    }
  }

  let teams = []
  return Promise.all(teamsByRegion).then((regionTeams) => {
    for (let i = 0; i < regionTeams.length; i++) {
      teams = [...teams, ...regionTeams[i]]
    }
  })
}

module.exports = AssignCaptain
