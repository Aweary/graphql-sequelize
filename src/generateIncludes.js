import argsToFindOptions from './argsToFindOptions';
import _ from 'lodash';

export default function generateIncludes(simpleAST, type, root, options) {
  var result = {include: [], attributes: []};

  type = type.ofType || type;
  options = options || {};
  if (options.include === undefined) options.include = true;

  Object.keys(simpleAST).forEach(function (key) {
    var association
      , includeOptions
      , args = simpleAST[key].args
      , includeResolver = type._fields[key].resolve
      , nestedResult
      , allowedAttributes;

    if (!includeResolver) return;

    if (includeResolver.$proxy) {
      while (includeResolver.$proxy) {
        includeResolver = includeResolver.$proxy;
      }
    }

    if (includeResolver.$passthrough) {
      var dummyResult = generateIncludes(
        simpleAST[key].fields,
        type._fields[key].type,
        root
      );
      result.include = result.include.concat(dummyResult.include);
      return;
    }

    association = includeResolver.$association;

    if (association) {
      includeOptions = argsToFindOptions(args, association.target);
      allowedAttributes = Object.keys(association.target.rawAttributes);

      if (includeResolver.$before) {
        includeOptions = includeResolver.$before(includeOptions, args, root, {
          ast: simpleAST,
          type: type
        });
      }

      if (options.include && !includeOptions.limit) {
        if (includeOptions.order) {
          includeOptions.order.map(function (order) {
            order.unshift({
              model: association.target,
              as: association.options.as
            });

            return order;
          });

          result.order = (result.order || []).concat(includeOptions.order);
          delete includeOptions.order;
        }

        includeOptions.attributes = Object.keys(simpleAST[key].fields)
                                    .filter(attribute => ~allowedAttributes.indexOf(attribute));

        includeOptions.attributes.push(association.target.primaryKeyAttribute);

        nestedResult = generateIncludes(
          simpleAST[key].fields,
          type._fields[key].type,
          root,
          includeResolver.$options
        );

        includeOptions.include = (includeOptions.include || []).concat(nestedResult.include);
        includeOptions.attributes = _.unique(includeOptions.attributes.concat(nestedResult.attributes));

        result.include.push(_.assign({association: association}, includeOptions));
      } else if (association.associationType === 'BelongsTo') {
        result.attributes.push(association.foreignKey);
      } else {
        result.attributes.push(association.source.primaryKeyAttribute);
      }
    }
  });

  return result;
}