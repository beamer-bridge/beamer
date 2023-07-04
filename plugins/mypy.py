from typing import Optional, Callable
from mypy.nodes import Var, SymbolTableNode, MDEF
from mypy.plugin import Plugin, AnalyzeTypeContext


class TxReceiptAttributePlugin(Plugin):

    def get_type_analyze_hook(self, fullname: str) -> Optional[Callable]:
        def func(ctx: AnalyzeTypeContext) -> None:
            symbol_table = ctx.api.lookup_fully_qualified('web3.types.TxReceipt')
            names = symbol_table.node.names
            type_items = symbol_table.node.typeddict_type.items
            for attr_name, attr_type in type_items.items():
                if getattr(attr_type, "items", None):
                    node = Var(attr_name, attr_type)
                    node.info = attr_type.items[0].type
                else:
                    node = Var(attr_name, attr_type)
                    node.info = attr_type.type
                names[node.name] = SymbolTableNode(MDEF, node)
            return symbol_table.node.typeddict_type

        if 'TxReceipt' in fullname:
            return func
        return None


def plugin(version: str) -> Plugin:
    return TxReceiptAttributePlugin
