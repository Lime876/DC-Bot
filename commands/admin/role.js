import { SlashCommandBuilder, PermissionsBitField, MessageFlags, AttachmentBuilder } from 'discord.js';
import Canvas from 'canvas';
import { getGuildLanguage, getTranslatedText } from '../../utils/languageUtils.js';
import logger from '../../utils/logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Manages roles within the server.')
    .setDescriptionLocalizations({ de: getTranslatedText('de', 'role_command.DESCRIPTION'), 'en-US': getTranslatedText('en', 'role_command.DESCRIPTION') })
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .addSubcommand(sub => sub.setName('add').setDescription('Assigns a role to a user.').addUserOption(o => o.setName('user').setDescription('User to assign role').setRequired(true)).addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true)))
    .addSubcommand(sub => sub.setName('remove').setDescription('Removes a role from a user.').addUserOption(o => o.setName('user').setDescription('User to remove role from').setRequired(true)).addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true)))
    .addSubcommand(sub => sub.setName('create').setDescription('Creates a new role.').addStringOption(o => o.setName('name').setDescription('Name of the new role').setRequired(true)).addStringOption(o => o.setName('color').setDescription('Hex color code')).addBooleanOption(o => o.setName('hoist').setDescription('Display separately')).addBooleanOption(o => o.setName('mentionable').setDescription('Can be mentioned')))
    .addSubcommand(sub => sub.setName('delete').setDescription('Deletes a role.').addRoleOption(o => o.setName('role').setDescription('Role to delete').setRequired(true)))
    .addSubcommand(sub => sub.setName('info').setDescription('Displays information about a role.').addRoleOption(o => o.setName('role').setDescription('Role to get info').setRequired(true))),

  category: 'Admin',

  async execute(interaction) {
    const guild = interaction.guild;
    const lang = await getGuildLanguage(guild.id);

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return interaction.reply({ content: getTranslatedText(lang, 'permissions.MISSING_PERMISSION_SINGULAR', { permission: 'Manage Roles' }), flags: [MessageFlags.Ephemeral] });
    }

    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    try {
      switch (sub) {
        case 'add': {
          const member = interaction.options.getMember('user');
          const role = interaction.options.getRole('role');
          if (!member || !role) return interaction.editReply({ content: getTranslatedText(lang, 'role_command.USER_OR_ROLE_NOT_FOUND') });
          if (member.roles.cache.has(role.id)) return interaction.editReply({ content: getTranslatedText(lang, 'role_command.ADD_FAIL_ALREADY_HAS_ROLE', { userName: member.user.tag, roleName: role.name }) });
          await member.roles.add(role);
          return interaction.editReply({ content: getTranslatedText(lang, 'role_command.ADD_SUCCESS', { userName: member.user.tag, roleName: role.name }) });
        }

        case 'remove': {
          const member = interaction.options.getMember('user');
          const role = interaction.options.getRole('role');
          if (!member || !role) return interaction.editReply({ content: getTranslatedText(lang, 'role_command.USER_OR_ROLE_NOT_FOUND') });
          if (!member.roles.cache.has(role.id)) return interaction.editReply({ content: getTranslatedText(lang, 'role_command.REMOVE_FAIL_DOES_NOT_HAVE_ROLE', { userName: member.user.tag, roleName: role.name }) });
          await member.roles.remove(role);
          return interaction.editReply({ content: getTranslatedText(lang, 'role_command.REMOVE_SUCCESS', { userName: member.user.tag, roleName: role.name }) });
        }

        case 'create': {
          const name = interaction.options.getString('name');
          const colorInput = interaction.options.getString('color');
          const hoist = interaction.options.getBoolean('hoist') || false;
          const mentionable = interaction.options.getBoolean('mentionable') || false;
          let color = colorInput ? parseInt(colorInput.replace('#',''), 16) : 0x000000;
          const newRole = await guild.roles.create({ name, color, hoist, mentionable, reason: `Role created by ${interaction.user.tag}` });
          return interaction.editReply({ content: getTranslatedText(lang, 'role_command.CREATE_SUCCESS', { roleName: newRole.name, roleMention: newRole.toString() }) });
        }

        case 'delete': {
          const role = interaction.options.getRole('role');
          if (!role) return interaction.editReply({ content: getTranslatedText(lang, 'role_command.ROLE_NOT_FOUND') });
          await role.delete(`Deleted by ${interaction.user.tag}`);
          return interaction.editReply({ content: getTranslatedText(lang, 'role_command.DELETE_SUCCESS', { roleName: role.name }) });
        }

        case 'info': {
          const role = interaction.options.getRole('role');
          if (!role) return interaction.editReply({ content: getTranslatedText(lang, 'role_command.ROLE_NOT_FOUND') });

          const canvas = Canvas.createCanvas(700, 250);
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = role.hexColor !== '#000000' ? role.hexColor : '#2f3136';
          ctx.fillRect(0, 0, 700, 250);
          ctx.font = 'bold 40px Sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(role.name, 20, 60);
          ctx.font = '20px Sans-serif'; ctx.fillStyle = '#dddddd'; ctx.fillText(`ID: ${role.id}`, 20, 100);
          ctx.fillText(`Mitglieder: ${role.members.size}`, 20, 140);
          ctx.fillText(`Position: ${role.position}`, 20, 180);
          ctx.fillText(`Sichtbar separat: ${role.hoist ? 'Ja' : 'Nein'}`, 20, 210);
          ctx.fillText(`Erwähnbar: ${role.mentionable ? 'Ja' : 'Nein'}`, 350, 210);

          const perms = role.permissions.toArray().join(', ');
          ctx.font = '16px Sans-serif'; ctx.fillText('Berechtigungen:', 350, 40);
          ctx.font = '14px Sans-serif'; (perms.match(/.{1,50}/g) || []).forEach((line,i)=>ctx.fillText(line, 350, 70+i*20));

          const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'role-info.png' });
          return interaction.editReply({ files: [attachment] });
        }

        default:
          return interaction.editReply({ content: getTranslatedText(lang, 'bot_messages.UNKNOWN_SUBCOMMAND') });
      }
    } catch (error) {
      logger.error(`[Role Command] Error on subcommand '${sub}' in guild ${guild.id}:`, error);
      return interaction.editReply({ content: getTranslatedText(lang, 'bot_messages.ERROR_OCCURRED_UNEXPECTED', { errorMessage: error.message }) });
    }
  }
};