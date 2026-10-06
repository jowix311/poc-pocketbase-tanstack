/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    let collection = new Collection({
      type: 'base',
      name: 'todos',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: '',
      fields: [
        {
          type: 'text',
          name: 'title',
          required: true,
          max: 200,
        },
        {
          type: 'bool',
          name: 'completed',
        },
        {
          type: 'autodate',
          name: 'created',
          onCreate: true,
          onUpdate: false,
        },
        {
          type: 'autodate',
          name: 'updated',
          onCreate: true,
          onUpdate: true,
        },
      ],
    })
    app.save(collection)
  },
  (app) => {
    try {
      let collection = app.findCollectionByNameOrId('todos')
      app.delete(collection)
    } catch {
      // already deleted
    }
  },
)
