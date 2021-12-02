import { CommandInteraction } from 'eris';
import HeroesbotClient from '../Client';
import { Logger } from '../util';

export default (client: HeroesbotClient) => {
  client.on('interactionCreate', (interaction) => {        
    if (!client.ready) return;

    if (interaction instanceof CommandInteraction) {
      Logger.debug('Interaction to execute', interaction.data);

      const interactionName = interaction.data.name;

      const interactionToExecute = client.interactionCommands.get(interactionName);

      if (interactionToExecute) {
        interactionToExecute.execute(interaction);
      }
    } else {
      Logger.warn('Unknown interaction', interaction);
    }
  });
};